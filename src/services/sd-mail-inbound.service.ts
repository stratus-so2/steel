import { createId } from '@paralleldrive/cuid2'
import type { SdAttachmentKind, SdMessageAuthorKind } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { sdMailboxNotFound } from '@/src/errors'
import {
  fetchSdMailbox,
  type SdFetchedMail,
} from '@/src/lib/mail/sd-mailbox-transport'
import { err, ok, type Result } from '@/src/lib/result'
import {
  cleanSdMailBody,
  isSdMailAutomatic,
  normalizeSdMailAddress,
  sdMailHtmlToText,
  sdMailSenderAllowed,
  sdMailTicketCodeFromSubject,
  sdMailTicketTitle,
} from '@/src/lib/servicedesk/mail-text'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import {
  SD_ATTACHMENT_MAX_BYTES,
  SD_TICKET_BUCKET,
  sdAttachmentKey,
  sdAttachmentKind,
  sdBaseMime,
} from '@/src/lib/servicedesk/ticket-files'
import { sdPlainTextToHtml } from '@/src/lib/servicedesk/whatsapp'
import { ensureBucket, putObject } from '@/src/lib/storage/s3'
import { SdContactRepository } from '@/src/repositories/sd-contact.repository'
import {
  SdMailboxRepository,
  type SdMailboxRow,
  SdMailMessageRepository,
} from '@/src/repositories/sd-mailbox.repository'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import type { SdMailboxSyncDTO } from '@/types/sd-mailbox'
import { SdAccess } from './sd-access'
import { fireSdAutomations } from './sd-automation-engine'
import { decryptSdMailbox } from './sd-mail-credentials'
import { SdMailOutboundService } from './sd-mail-outbound.service'
import {
  type SdEngineConfig,
  SdTicketEngine,
  sdSystemActor,
  sdTicketCode,
} from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { notifySdTicketReply } from './sd-ticket-reply-notify'

/**
 * Recepção do canal de e-mail (fluxo de sistema, sem usuário): o tick
 * `servicedesk-mail` lê cada caixa ativa e, para cada mensagem nova,
 *
 * 1. descarta duplicata (`mailboxId + Message-ID`) e e-mail da própria caixa;
 * 2. aplica as listas de remetentes e o limite por hora da caixa;
 * 3. marca resposta automática/devolução (`automatic`): registra e para;
 * 4. acha o chamado pela thread (`In-Reply-To`/`References`) ou pelo código
 *    no assunto e anexa a mensagem ao histórico (canal EMAIL);
 * 5. senão abre um chamado com os padrões da caixa, resolvendo o contato
 *    pelo e-mail (e criando um quando `createUnknownContacts`).
 *
 * Nada aqui lança: toda falha vira log + `error` na linha de `SdMailMessage`.
 */

const SOURCE = 'email'

/** Mensagens lidas por caixa a cada rodada. */
export const SD_MAIL_FETCH_LIMIT = 25

/** Teto de e-mails aceitos por caixa por hora (anti-enxurrada). */
export const SD_MAIL_HOURLY_LIMIT = 120

/** Caixas lidas por tick. */
export const SD_MAIL_MAILBOXES_PER_TICK = 50

const EMPTY: SdMailboxSyncDTO = {
  fetched: 0,
  opened: 0,
  appended: 0,
  skipped: 0,
  failed: 0,
}

type Outcome = 'opened' | 'appended' | 'skipped' | 'failed'

function audience(t: SdTicketWithRelations) {
  return {
    requesterId: t.requesterId,
    participantIds: t.participants.map((p) => p.userId),
    contactUserId: t.contact?.userId ?? null,
  }
}

async function publishMessage(ticket: SdTicketWithRelations): Promise<void> {
  await publishSdTicketEvent(
    ticket.workspaceId,
    {
      type: 'ticket.message',
      ticketId: ticket.id,
      number: ticket.number,
      at: new Date().toISOString(),
      actorId: null,
    },
    audience(ticket),
  )
}

/** Texto do e-mail, já sem citação e assinatura. */
export function sdMailBodyOf(mail: SdFetchedMail): string {
  const fromText = cleanSdMailBody(mail.text)
  if (fromText) return fromText
  return mail.html ? cleanSdMailBody(sdMailHtmlToText(mail.html)) : ''
}

interface StoredAttachment {
  id: string
  kind: SdAttachmentKind
  fileName: string
  mimeType: string
  size: number
  storageKey: string
}

/** Sobe os anexos aceitos para o MinIO; os recusados só viram log. */
async function storeAttachments(
  workspaceId: string,
  ticketId: string,
  mail: SdFetchedMail,
): Promise<StoredAttachment[]> {
  const stored: StoredAttachment[] = []
  if (mail.attachments.length === 0) return stored

  for (const attachment of mail.attachments) {
    const mimeType = sdBaseMime(attachment.mimeType)
    const kind = sdAttachmentKind(mimeType)
    if (!kind) continue
    if (attachment.content.byteLength > SD_ATTACHMENT_MAX_BYTES) continue

    const id = createId()
    const storageKey = sdAttachmentKey(
      workspaceId,
      ticketId,
      id,
      attachment.fileName,
    )
    try {
      await ensureBucket(SD_TICKET_BUCKET)
      await putObject({
        bucket: SD_TICKET_BUCKET,
        key: storageKey,
        body: attachment.content,
        contentType: mimeType,
      })
    } catch (cause) {
      logger.warn('servicedesk.mail.attachment_failed', {
        workspaceId,
        ticketId,
        message: cause instanceof Error ? cause.message : String(cause),
      })
      continue
    }
    stored.push({
      id,
      kind,
      fileName: attachment.fileName.slice(0, 255),
      mimeType,
      size: attachment.content.byteLength,
      storageKey,
    })
  }
  return stored
}

interface MailContact {
  id: string | null
  userId: string | null
}

/** Contato do workspace pelo e-mail; cria um quando a caixa permite. */
async function resolveContact(
  mailbox: SdMailboxRow,
  mail: SdFetchedMail,
): Promise<MailContact> {
  const found = await SdMailMessageRepository.findContactIdByEmail(
    mailbox.workspaceId,
    mail.fromAddress,
  )
  if (found.ok && found.value) return found.value
  if (!found.ok) {
    logger.warn('servicedesk.mail.contact_lookup_failed', {
      workspaceId: mailbox.workspaceId,
      reason: found.error.code,
    })
  }
  if (!mailbox.createUnknownContacts) return { id: null, userId: null }

  const created = await SdContactRepository.create(
    {
      workspaceId: mailbox.workspaceId,
      createdById: mailbox.createdById,
      name: mail.fromName?.slice(0, 120) || mail.fromAddress,
      email: mail.fromAddress,
    },
    [],
  )
  if (!created.ok) {
    logger.warn('servicedesk.mail.contact_create_failed', {
      workspaceId: mailbox.workspaceId,
      reason: created.error.code,
    })
    return { id: null, userId: null }
  }
  return { id: created.value.id, userId: created.value.userId }
}

/** Chamado da thread: `In-Reply-To`/`References` e, como reserva, o assunto. */
async function findThreadTicket(
  mailbox: SdMailboxRow,
  mail: SdFetchedMail,
): Promise<Result<SdTicketWithRelations | null>> {
  const ids = [...(mail.inReplyTo ? [mail.inReplyTo] : []), ...mail.references]
  const byThread = await SdMailMessageRepository.findThreadTicketId(
    mailbox.workspaceId,
    [...new Set(ids)],
  )
  if (!byThread.ok) return byThread

  let ticketId = byThread.value
  if (!ticketId) {
    const code = sdMailTicketCodeFromSubject(mail.subject)
    if (code) {
      const bySubject = await SdMailMessageRepository.findTicketIdByNumber(
        mailbox.workspaceId,
        code.number,
      )
      if (!bySubject.ok) return bySubject
      ticketId = bySubject.value
    }
  }
  if (!ticketId) return ok(null)

  const ticket = await SdTicketRepository.findById(
    ticketId,
    mailbox.workspaceId,
  )
  // Chamado apagado depois da thread: segue como abertura nova.
  if (!ticket.ok) return ok(null)
  return ok(ticket.value)
}

async function recordMail(
  mailbox: SdMailboxRow,
  mail: SdFetchedMail,
  extra: {
    ticketId?: string | null
    ticketMessageId?: string | null
    body?: string | null
    automatic?: boolean
    error?: string | null
  },
): Promise<void> {
  const saved = await SdMailMessageRepository.create({
    workspaceId: mailbox.workspaceId,
    mailboxId: mailbox.id,
    ticketId: extra.ticketId ?? null,
    ticketMessageId: extra.ticketMessageId ?? null,
    messageId: mail.messageId,
    inReplyTo: mail.inReplyTo,
    references: mail.references.slice(-20),
    direction: 'INBOUND',
    fromAddress: mail.fromAddress,
    fromName: mail.fromName,
    toAddresses: mail.toAddresses,
    ccAddresses: mail.ccAddresses,
    subject: mail.subject,
    bodyText: extra.body ?? null,
    automatic: extra.automatic ?? false,
    processedAt: new Date(),
    error: extra.error ?? null,
  })
  if (!saved.ok) {
    logger.error('servicedesk.mail.record_failed', {
      workspaceId: mailbox.workspaceId,
      mailboxId: mailbox.id,
      reason: saved.error.code,
    })
  }
}

/** Anexa a mensagem ao chamado da thread. */
async function appendToTicket(
  mailbox: SdMailboxRow,
  config: SdEngineConfig,
  ticket: SdTicketWithRelations,
  mail: SdFetchedMail,
  body: string,
): Promise<Outcome> {
  const contact = await resolveContact(mailbox, mail)
  const attachments = await storeAttachments(
    mailbox.workspaceId,
    ticket.id,
    mail,
  )
  if (!body && attachments.length === 0) {
    await recordMail(mailbox, mail, {
      ticketId: ticket.id,
      error: 'Mensagem sem conteúdo aproveitável',
    })
    return 'skipped'
  }

  const authorKind: SdMessageAuthorKind = contact.id ? 'CONTACT' : 'REQUESTER'
  const created = await SdMailMessageRepository.createTicketMessage({
    workspaceId: mailbox.workspaceId,
    ticketId: ticket.id,
    authorKind,
    authorUserId: contact.userId,
    authorContactId: contact.id,
    body,
    attachments,
  })
  if (!created.ok) {
    await recordMail(mailbox, mail, {
      ticketId: ticket.id,
      body,
      error: created.error.message,
    })
    return 'failed'
  }

  await SdTicketEngine.touchActivity(ticket.id)
  await recordSdTicketEvent({
    workspaceId: mailbox.workspaceId,
    ticketId: ticket.id,
    actorKind: authorKind,
    actorUserId: contact.userId,
    action: 'message.posted',
    meta: {
      messageId: created.value.id,
      channel: 'EMAIL',
      visibility: 'PUBLIC',
      attachments: attachments.length,
    },
  })

  let reopenNotified = false
  if (
    ticket.phase.category === 'RESOLVED' &&
    config.settings.reopenOnRequesterReply
  ) {
    const reopened = await SdTicketEngine.reopen(
      ticket,
      sdSystemActor(SOURCE),
      config,
    )
    if (!reopened.ok) {
      logger.warn('servicedesk.mail.reopen_failed', {
        workspaceId: mailbox.workspaceId,
        ticketId: ticket.id,
        reason: reopened.error.code,
      })
    } else reopenNotified = true
  }
  // The reopen already told the team (`ticket.reopened`): no second notice.
  if (!reopenNotified) {
    await notifySdTicketReply({
      workspaceId: mailbox.workspaceId,
      ticket,
      channel: 'EMAIL',
      actorId: contact.userId,
      body,
      attachments: attachments.length,
    })
  }

  void fireSdAutomations('MESSAGE_RECEIVED', ticket.id)
  await publishMessage(ticket)
  await recordMail(mailbox, mail, {
    ticketId: ticket.id,
    ticketMessageId: created.value.id,
    body,
  })
  return 'appended'
}

/** Abre um chamado com os padrões da caixa. */
async function openTicket(
  mailbox: SdMailboxRow,
  config: SdEngineConfig,
  mail: SdFetchedMail,
  body: string,
): Promise<Outcome> {
  const contact = await resolveContact(mailbox, mail)
  const title = sdMailTicketTitle(mail.subject)
  const created = await SdTicketEngine.create(
    mailbox.workspaceId,
    {
      type: mailbox.defaultType,
      title,
      description: body ? sdPlainTextToHtml(body) : undefined,
      channel: 'EMAIL',
      contactId: contact.id ?? undefined,
      requesterId: contact.userId,
      departmentId: mailbox.defaultDepartmentId ?? undefined,
      categoryId: mailbox.defaultCategoryId ?? undefined,
      priorityId: mailbox.defaultPriorityId ?? undefined,
    },
    sdSystemActor(SOURCE),
    config,
  )
  if (!created.ok) {
    auditMutation({
      entity: 'sd_ticket',
      action: 'create',
      actorId: null,
      outcome: 'failure',
      reason: created.error.code,
      meta: { workspaceId: mailbox.workspaceId, channel: 'EMAIL' },
    })
    await recordMail(mailbox, mail, { body, error: created.error.message })
    return 'failed'
  }
  const ticket = created.value

  auditMutation({
    entity: 'sd_ticket',
    action: 'create',
    actorId: null,
    targetId: ticket.id,
    meta: {
      workspaceId: mailbox.workspaceId,
      type: ticket.type,
      channel: 'EMAIL',
      actor: 'system',
      contactMatched: Boolean(contact.id),
    },
  })

  const attachments = await storeAttachments(
    mailbox.workspaceId,
    ticket.id,
    mail,
  )
  const authorKind: SdMessageAuthorKind = contact.id ? 'CONTACT' : 'REQUESTER'
  const message = await SdMailMessageRepository.createTicketMessage({
    workspaceId: mailbox.workspaceId,
    ticketId: ticket.id,
    authorKind,
    authorUserId: contact.userId,
    authorContactId: contact.id,
    body,
    attachments,
  })
  if (message.ok) {
    await recordSdTicketEvent({
      workspaceId: mailbox.workspaceId,
      ticketId: ticket.id,
      actorKind: authorKind,
      actorUserId: contact.userId,
      action: 'message.posted',
      meta: {
        messageId: message.value.id,
        channel: 'EMAIL',
        visibility: 'PUBLIC',
        attachments: attachments.length,
      },
    })
  }

  void fireSdAutomations('TICKET_CREATED', ticket.id)
  await publishMessage(ticket)

  const code = sdTicketCode(ticket, config.prefixes)
  await recordMail(mailbox, mail, {
    ticketId: ticket.id,
    ticketMessageId: message.ok ? message.value.id : null,
    body,
  })

  const ack = await SdMailOutboundService.sendAcknowledgement({
    mailbox,
    ticketId: ticket.id,
    code,
    title,
    to: mail.fromAddress,
    inReplyTo: mail.messageId,
    references: [...mail.references, mail.messageId].slice(-20),
    subject: mail.subject,
  })
  if (!ack.ok) {
    logger.warn('servicedesk.mail.acknowledgement_failed', {
      workspaceId: mailbox.workspaceId,
      ticketId: ticket.id,
      reason: ack.error.code,
    })
  }

  logger.info('servicedesk.mail.ticket_opened', {
    workspaceId: mailbox.workspaceId,
    mailboxId: mailbox.id,
    ticketId: ticket.id,
  })
  return 'opened'
}

export const SdMailInboundService = {
  /** Decide o que fazer com uma mensagem já lida da caixa. */
  async processMessage(
    mailbox: SdMailboxRow,
    config: SdEngineConfig,
    mail: SdFetchedMail,
  ): Promise<Outcome> {
    const existing = await SdMailMessageRepository.findByMessageId(
      mailbox.id,
      mail.messageId,
    )
    if (!existing.ok) return 'failed'
    if (existing.value) return 'skipped'

    const from = normalizeSdMailAddress(mail.fromAddress)
    // Guarda de laço: e-mail que a própria caixa mandou volta para ela.
    if (from === mailbox.address.toLowerCase()) {
      await recordMail(mailbox, mail, {
        automatic: true,
        error: 'Mensagem da própria caixa (laço)',
      })
      return 'skipped'
    }

    if (!sdMailSenderAllowed(from, mailbox)) {
      await recordMail(mailbox, mail, {
        error: 'Remetente fora das listas da caixa',
      })
      return 'skipped'
    }

    const body = sdMailBodyOf(mail)
    const thread = await findThreadTicket(mailbox, mail)
    if (!thread.ok) return 'failed'

    if (
      isSdMailAutomatic({
        headers: mail.headers,
        subject: mail.subject,
        fromAddress: mail.fromAddress,
      })
    ) {
      await recordMail(mailbox, mail, {
        ticketId: thread.value?.id ?? null,
        body,
        automatic: true,
      })
      return 'skipped'
    }

    if (thread.value) {
      return appendToTicket(mailbox, config, thread.value, mail, body)
    }

    const since = new Date(Date.now() - 60 * 60 * 1000)
    const recent = await SdMailMessageRepository.countInboundSince(
      mailbox.id,
      since,
    )
    if (!recent.ok) return 'failed'
    if (recent.value >= SD_MAIL_HOURLY_LIMIT) {
      await recordMail(mailbox, mail, {
        body,
        error: 'Limite de e-mails por hora da caixa atingido',
      })
      return 'skipped'
    }

    return openTicket(mailbox, config, mail, body)
  },

  /** Lê uma caixa e processa o que chegou. Nunca lança. */
  async syncMailbox(mailboxId: string): Promise<Result<SdMailboxSyncDTO>> {
    const found = await SdMailboxRepository.findByIdUnscoped(mailboxId)
    if (!found.ok) return found
    if (!found.value) return ok({ ...EMPTY })
    const mailbox = found.value
    // Leitura manual de uma caixa pausada não a religa.
    const paused = mailbox.status === 'PAUSED'

    const credentials = await decryptSdMailbox(mailbox)
    if (!credentials.ok) {
      await SdMailboxRepository.markSync(mailbox.id, {
        status: paused ? 'PAUSED' : 'ERROR',
        statusError: credentials.error.message,
        lastSyncAt: new Date(),
      })
      return ok({ ...EMPTY, failed: 1 })
    }

    let fetched: Awaited<ReturnType<typeof fetchSdMailbox>>
    try {
      fetched = await fetchSdMailbox(credentials.value.imap, {
        sinceUid: mailbox.lastSeenUid,
        limit: SD_MAIL_FETCH_LIMIT,
        maxAttachmentBytes: SD_ATTACHMENT_MAX_BYTES,
        processedFolder: mailbox.processedFolder,
      })
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Falha ao ler a caixa'
      logger.error('servicedesk.mail.fetch_failed', {
        workspaceId: mailbox.workspaceId,
        mailboxId: mailbox.id,
        message,
      })
      await SdMailboxRepository.markSync(mailbox.id, {
        status: paused ? 'PAUSED' : 'ERROR',
        statusError: message,
        lastSyncAt: new Date(),
      })
      return ok({ ...EMPTY, failed: 1 })
    }

    const config = await SdTicketEngine.loadConfig(mailbox.workspaceId)
    if (!config.ok) return config

    const result: SdMailboxSyncDTO = {
      ...EMPTY,
      fetched: fetched.messages.length,
    }
    for (const mail of fetched.messages) {
      const outcome = await SdMailInboundService.processMessage(
        mailbox,
        config.value,
        mail,
      )
      if (outcome === 'opened') result.opened += 1
      else if (outcome === 'appended') result.appended += 1
      else if (outcome === 'failed') result.failed += 1
      else result.skipped += 1
    }

    await SdMailboxRepository.markSync(mailbox.id, {
      status: paused ? 'PAUSED' : 'ACTIVE',
      statusError: null,
      lastSeenUid: fetched.lastUid ?? mailbox.lastSeenUid,
      lastSyncAt: new Date(),
    })
    logger.info('servicedesk.mail.synced', {
      workspaceId: mailbox.workspaceId,
      mailboxId: mailbox.id,
      ...result,
    })
    return ok(result)
  },

  /** Tick do worker: percorre todas as caixas lidas pelo módulo. */
  async runTick(): Promise<SdMailboxSyncDTO & { mailboxes: number }> {
    const rows = await SdMailboxRepository.listPollable(
      SD_MAIL_MAILBOXES_PER_TICK,
    )
    if (!rows.ok) {
      logger.error('servicedesk.mail.tick_failed', {
        reason: rows.error.code,
      })
      return { ...EMPTY, mailboxes: 0 }
    }

    const total: SdMailboxSyncDTO & { mailboxes: number } = {
      ...EMPTY,
      mailboxes: rows.value.length,
    }
    for (const mailbox of rows.value) {
      const synced = await SdMailInboundService.syncMailbox(mailbox.id)
      if (!synced.ok) {
        total.failed += 1
        continue
      }
      total.fetched += synced.value.fetched
      total.opened += synced.value.opened
      total.appended += synced.value.appended
      total.skipped += synced.value.skipped
      total.failed += synced.value.failed
    }
    return total
  },

  /** Leitura manual pela tela de configurações (admin do módulo). */
  async syncNow(
    actorId: string,
    workspaceId: string,
    mailboxId: string,
  ): Promise<Result<SdMailboxSyncDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const found = await SdMailboxRepository.findById(mailboxId, workspaceId)
    if (!found.ok) return found
    if (!found.value) return err(sdMailboxNotFound())
    return SdMailInboundService.syncMailbox(mailboxId)
  },
}
