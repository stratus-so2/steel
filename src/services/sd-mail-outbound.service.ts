import { logger } from '@/lib/axiom/logger'
import { MAIL_DRY_RUN } from '@/lib/env/server'
import {
  type SdOutboundMail,
  sendSdSmtp,
} from '@/src/lib/mail/sd-mailbox-transport'
import { sendEmail } from '@/src/lib/mail/send'
import { ok, type Result } from '@/src/lib/result'
import {
  sdMailOutboundBody,
  sdMailReferences,
  sdMailReplySubject,
} from '@/src/lib/servicedesk/mail-text'
import {
  SdMailboxRepository,
  type SdMailboxRow,
  SdMailMessageRepository,
} from '@/src/repositories/sd-mailbox.repository'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import { decryptSdMailbox } from './sd-mail-credentials'
import { SdTicketEngine, sdTicketCode } from './sd-ticket-engine'

/**
 * Saída do canal de e-mail: a resposta pública do agente volta para quem
 * abriu o chamado, pela caixa que o recebeu, com `In-Reply-To`/`References`
 * para o cliente de e-mail encadear e o código do chamado no assunto.
 *
 * Sem SMTP na caixa, o envio cai na camada de e-mail do Steel (Resend) com
 * `Reply-To` apontando para o endereço da caixa — a resposta volta para o
 * IMAP do mesmo jeito. `MAIL_DRY_RUN=true` não manda nada.
 */

const DRY_RUN = () => MAIL_DRY_RUN === 'true'

/** Texto que fecha todo e-mail enviado pelo chamado. */
function footer(code: string): string {
  return `Chamado ${code} · responda este e-mail para falar com a equipe.`
}

export interface SdMailSendInput {
  mailbox: SdMailboxRow
  to: string
  subject: string
  body: string
  inReplyTo: string | null
  references: string[]
  code: string
}

function messageIdFor(mailbox: SdMailboxRow): string {
  const domain = mailbox.address.split('@')[1] ?? 'steel.local'
  const random = Math.random().toString(36).slice(2, 10)
  return `<${Date.now().toString(36)}.${random}@${domain}>`
}

/**
 * Manda o e-mail e devolve o `Message-ID` enviado. Nunca lança: a falha
 * vira `null` + log (a mensagem do chamado já foi gravada).
 */
export async function deliverSdMail(
  input: SdMailSendInput,
): Promise<string | null> {
  const text = sdMailOutboundBody(input.body, footer(input.code))

  if (DRY_RUN()) {
    logger.info('servicedesk.mail.dry_run', {
      workspaceId: input.mailbox.workspaceId,
      mailboxId: input.mailbox.id,
      subject: input.subject,
    })
    return messageIdFor(input.mailbox)
  }

  const credentials = await decryptSdMailbox(input.mailbox)
  if (!credentials.ok) {
    logger.warn('servicedesk.mail.credentials_failed', {
      workspaceId: input.mailbox.workspaceId,
      mailboxId: input.mailbox.id,
      reason: credentials.error.code,
    })
    return null
  }

  const mail: SdOutboundMail = {
    from: { name: input.mailbox.name, address: input.mailbox.address },
    to: input.to,
    subject: input.subject,
    text,
    inReplyTo: input.inReplyTo,
    references: input.references,
  }

  try {
    if (credentials.value.smtp) {
      return await sendSdSmtp(credentials.value.smtp, mail)
    }
    const headers: Record<string, string> = {}
    if (input.inReplyTo) headers['In-Reply-To'] = input.inReplyTo
    if (input.references.length) {
      headers.References = input.references.join(' ')
    }
    const sent = await sendEmail({
      to: input.to,
      subject: input.subject,
      text,
      replyTo: input.mailbox.address,
      ...(Object.keys(headers).length ? { headers } : {}),
    })
    return `<${sent.id}@resend>`
  } catch (cause) {
    logger.error('servicedesk.mail.send_failed', {
      workspaceId: input.mailbox.workspaceId,
      mailboxId: input.mailbox.id,
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return null
  }
}

/** Destino da resposta: o último remetente, senão o e-mail do contato. */
function recipientOf(
  ticket: SdTicketWithRelations,
  lastInbound: { fromAddress: string } | null,
): string | null {
  const address = lastInbound?.fromAddress ?? ticket.contact?.email ?? null
  return address ? address.trim().toLowerCase() : null
}

export const SdMailOutboundService = {
  /**
   * Resposta pública de um agente num chamado que veio por e-mail. Chamada
   * em segundo plano pelo histórico do chamado: nunca derruba a requisição,
   * nunca lança e é idempotente por mensagem (`ticketMessageId`).
   */
  async sendTicketReply(input: {
    workspaceId: string
    ticketId: string
    ticketMessageId: string
    body: string
  }): Promise<Result<'sent' | 'skipped'>> {
    const mailboxId = await SdMailMessageRepository.findMailboxIdForTicket(
      input.ticketId,
    )
    if (!mailboxId.ok) return mailboxId
    if (!mailboxId.value) return ok('skipped')

    const already = await SdMailMessageRepository.hasOutboundFor(
      input.ticketMessageId,
    )
    if (!already.ok) return already
    if (already.value) return ok('skipped')

    const mailbox = await SdMailboxRepository.findByIdUnscoped(mailboxId.value)
    if (!mailbox.ok) return mailbox
    if (!mailbox.value) return ok('skipped')

    const ticket = await SdTicketRepository.findById(
      input.ticketId,
      input.workspaceId,
    )
    if (!ticket.ok) return ticket

    const lastInbound = await SdMailMessageRepository.findLastInbound(
      input.ticketId,
    )
    if (!lastInbound.ok) return lastInbound

    const to = recipientOf(ticket.value, lastInbound.value)
    if (!to) return ok('skipped')
    // Guarda de laço: nunca responder para a própria caixa.
    if (to === mailbox.value.address.toLowerCase()) return ok('skipped')

    const config = await SdTicketEngine.loadConfig(input.workspaceId)
    if (!config.ok) return config
    const code = sdTicketCode(ticket.value, config.value.prefixes)
    const subject = sdMailReplySubject(
      code,
      lastInbound.value?.subject ?? ticket.value.title,
    )
    const inReplyTo = lastInbound.value?.messageId ?? null
    const references = sdMailReferences(
      lastInbound.value?.references ?? [],
      inReplyTo,
    )

    const messageId = await deliverSdMail({
      mailbox: mailbox.value,
      to,
      subject,
      body: input.body,
      inReplyTo,
      references,
      code,
    })
    if (!messageId) return ok('skipped')

    const recorded = await SdMailMessageRepository.create({
      workspaceId: input.workspaceId,
      mailboxId: mailbox.value.id,
      ticketId: input.ticketId,
      ticketMessageId: input.ticketMessageId,
      messageId,
      inReplyTo,
      references,
      direction: 'OUTBOUND',
      fromAddress: mailbox.value.address,
      fromName: mailbox.value.name,
      toAddresses: [to],
      ccAddresses: [],
      subject,
      bodyText: input.body,
      automatic: false,
      processedAt: new Date(),
      error: null,
    })
    if (!recorded.ok) return recorded

    logger.info('servicedesk.mail.reply_sent', {
      workspaceId: input.workspaceId,
      ticketId: input.ticketId,
      mailboxId: mailbox.value.id,
    })
    return ok('sent')
  },

  /** Confirmação de abertura com o código do chamado (`sendAcknowledgement`). */
  async sendAcknowledgement(input: {
    mailbox: SdMailboxRow
    ticketId: string
    code: string
    title: string
    to: string
    inReplyTo: string | null
    references: string[]
    subject: string | null
  }): Promise<Result<'sent' | 'skipped'>> {
    if (!input.mailbox.sendAcknowledgement) return ok('skipped')
    const to = input.to.trim().toLowerCase()
    if (!to || to === input.mailbox.address.toLowerCase()) return ok('skipped')

    const subject = sdMailReplySubject(input.code, input.subject ?? input.title)
    const body = [
      `Recebemos sua solicitação e abrimos o chamado ${input.code}.`,
      '',
      `Assunto: ${input.title}`,
      '',
      'Nossa equipe já está com ele. Para enviar mais informações, basta responder este e-mail.',
    ].join('\n')

    const messageId = await deliverSdMail({
      mailbox: input.mailbox,
      to,
      subject,
      body,
      inReplyTo: input.inReplyTo,
      references: input.references,
      code: input.code,
    })
    if (!messageId) return ok('skipped')

    const recorded = await SdMailMessageRepository.create({
      workspaceId: input.mailbox.workspaceId,
      mailboxId: input.mailbox.id,
      ticketId: input.ticketId,
      ticketMessageId: null,
      messageId,
      inReplyTo: input.inReplyTo,
      references: input.references,
      direction: 'OUTBOUND',
      fromAddress: input.mailbox.address,
      fromName: input.mailbox.name,
      toAddresses: [to],
      ccAddresses: [],
      subject,
      bodyText: body,
      automatic: true,
      processedAt: new Date(),
      error: null,
    })
    if (!recorded.ok) return recorded
    return ok('sent')
  },
}
