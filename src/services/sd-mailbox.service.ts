import type { Prisma, SdMailboxStatus } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { sdMailboxConflict, sdMailboxNotFound } from '@/src/errors'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { err, ok, type Result } from '@/src/lib/result'
import { enqueueSdMailboxSync } from '@/src/lib/servicedesk/mail-queue'
import {
  type SdImapConfig,
  type SdSmtpConfig,
  verifySdImap,
  verifySdSmtp,
} from '@/src/lib/servicedesk/mail-transport'
import {
  toSdMailboxDTO,
  toSdTicketMailMessageDTO,
} from '@/src/mappers/sd-mailbox.mapper'
import {
  SdMailboxRepository,
  type SdMailboxRow,
  SdMailMessageRepository,
} from '@/src/repositories/sd-mailbox.repository'
import type {
  CreateSdMailboxDTO,
  UpdateSdMailboxDTO,
} from '@/src/schemas/sd-mailbox.schema'
import type {
  SdMailboxDTO,
  SdMailboxTestDTO,
  SdTicketMailMessageDTO,
} from '@/types/sd-mailbox'
import { SdAccess } from './sd-access'
import { decryptSdMailbox } from './sd-mail-credentials'
import { loadSdTicketTab } from './sd-ticket-tab-support'

/**
 * Caixas de e-mail do ServiceDesk: cadastro só pelos admins do módulo
 * (`SdAccess.requireAdmin`). As senhas entram em claro, saem cifradas com
 * `CONNECTION_SECRETS` e nunca voltam na API — o DTO só diz se o SMTP está
 * configurado.
 */

function audit(
  action: 'create' | 'update' | 'delete' | 'test',
  actorId: string,
  workspaceId: string,
  targetId: string | null,
  extra: {
    outcome?: 'failure'
    reason?: string
    meta?: Record<string, unknown>
  } = {},
) {
  auditMutation({
    entity: 'sd_mailbox',
    action,
    actorId,
    targetId,
    ...(extra.outcome ? { outcome: extra.outcome, reason: extra.reason } : {}),
    meta: { workspaceId, ...(extra.meta ?? {}) },
  })
}

async function loadOwned(
  workspaceId: string,
  id: string,
): Promise<Result<SdMailboxRow>> {
  const found = await SdMailboxRepository.findById(id, workspaceId)
  if (!found.ok) return found
  if (!found.value) return err(sdMailboxNotFound())
  return ok(found.value)
}

/** Campos do update que não precisam de tratamento especial. */
const PLAIN_FIELDS = [
  'name',
  'imapHost',
  'imapPort',
  'imapSecure',
  'imapUser',
  'folder',
  'processedFolder',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUser',
  'defaultType',
  'defaultDepartmentId',
  'defaultCategoryId',
  'defaultPriorityId',
  'allowedSenders',
  'blockedSenders',
  'createUnknownContacts',
  'sendAcknowledgement',
  'status',
] as const

async function updateData(
  dto: UpdateSdMailboxDTO,
): Promise<Prisma.SdMailboxUpdateInput> {
  const data: Record<string, unknown> = {}
  for (const field of PLAIN_FIELDS) {
    if (dto[field] !== undefined) data[field] = dto[field]
  }
  if (dto.imapPassword !== undefined) {
    data.encryptedImapPassword = await encryptConnectionSecret(dto.imapPassword)
  }
  if (dto.smtpPassword !== undefined) {
    data.encryptedSmtpPassword =
      dto.smtpPassword === null
        ? null
        : await encryptConnectionSecret(dto.smtpPassword)
  }
  // Voltar a ACTIVE limpa o erro da última leitura.
  if (dto.status === 'ACTIVE') data.statusError = null
  return data as Prisma.SdMailboxUpdateInput
}

async function testConnections(
  imap: SdImapConfig,
  smtp: SdSmtpConfig | null,
): Promise<{
  messages: number | null
  smtp: boolean | null
  error: string | null
}> {
  let messages: number | null = null
  try {
    messages = await verifySdImap(imap)
  } catch (cause) {
    return {
      messages: null,
      smtp: null,
      error:
        cause instanceof Error
          ? cause.message
          : 'Não foi possível conectar à caixa de e-mail',
    }
  }
  if (!smtp) return { messages, smtp: null, error: null }
  try {
    const verified = await verifySdSmtp(smtp)
    return {
      messages,
      smtp: verified,
      error: verified ? null : 'O servidor SMTP recusou as credenciais',
    }
  } catch (cause) {
    return {
      messages,
      smtp: false,
      error:
        cause instanceof Error ? cause.message : 'Falha ao testar o envio SMTP',
    }
  }
}

export const SdMailboxService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdMailboxDTO[]>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdMailboxRepository.listByWorkspace(workspaceId)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdMailboxDTO))
  },

  /**
   * Cadastra a caixa. Um endereço já usado por uma caixa **excluída** é
   * revivido no lugar (o índice único não olha `deletedAt`).
   */
  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdMailboxDTO,
  ): Promise<Result<SdMailboxDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) {
      audit('create', actorId, workspaceId, null, {
        outcome: 'failure',
        reason: ctx.error.code,
      })
      return ctx
    }

    const address = dto.address.trim().toLowerCase()
    const existing = await SdMailboxRepository.findByAddress(
      workspaceId,
      address,
    )
    if (!existing.ok) return existing
    if (existing.value && !existing.value.deletedAt) {
      return err(sdMailboxConflict())
    }

    const fields = {
      name: dto.name,
      address,
      imapHost: dto.imapHost,
      imapPort: dto.imapPort,
      imapSecure: dto.imapSecure,
      imapUser: dto.imapUser,
      encryptedImapPassword: await encryptConnectionSecret(dto.imapPassword),
      folder: dto.folder,
      processedFolder: dto.processedFolder ?? null,
      smtpHost: dto.smtpHost ?? null,
      smtpPort: dto.smtpPort ?? null,
      smtpSecure: dto.smtpSecure,
      smtpUser: dto.smtpUser ?? null,
      encryptedSmtpPassword: dto.smtpPassword
        ? await encryptConnectionSecret(dto.smtpPassword)
        : null,
      defaultType: dto.defaultType,
      defaultDepartmentId: dto.defaultDepartmentId ?? null,
      defaultCategoryId: dto.defaultCategoryId ?? null,
      defaultPriorityId: dto.defaultPriorityId ?? null,
      allowedSenders: dto.allowedSenders,
      blockedSenders: dto.blockedSenders,
      createUnknownContacts: dto.createUnknownContacts,
      sendAcknowledgement: dto.sendAcknowledgement,
    }

    const saved = existing.value
      ? await SdMailboxRepository.update(existing.value.id, {
          ...fields,
          deletedAt: null,
          status: 'ACTIVE',
          statusError: null,
          lastSeenUid: null,
          lastSyncAt: null,
        })
      : await SdMailboxRepository.create({
          ...fields,
          workspaceId,
          createdById: actorId,
        })
    if (!saved.ok) {
      audit('create', actorId, workspaceId, null, {
        outcome: 'failure',
        reason: saved.error.code,
      })
      return saved
    }

    audit('create', actorId, workspaceId, saved.value.id, {
      meta: { address, revived: Boolean(existing.value) },
    })
    logger.info('servicedesk.mailbox.created', {
      workspaceId,
      mailboxId: saved.value.id,
    })
    // Adianta a primeira leitura (o tick de 1 min pegaria logo depois).
    void enqueueSdMailboxSync(saved.value.id)
    return ok(toSdMailboxDTO(saved.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    id: string,
    dto: UpdateSdMailboxDTO,
  ): Promise<Result<SdMailboxDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const existing = await loadOwned(workspaceId, id)
    if (!existing.ok) return existing

    const updated = await SdMailboxRepository.update(id, await updateData(dto))
    if (!updated.ok) return updated

    audit('update', actorId, workspaceId, id, {
      meta: { fields: Object.keys(dto) },
    })
    return ok(toSdMailboxDTO(updated.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<void>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const existing = await loadOwned(workspaceId, id)
    if (!existing.ok) return existing

    const removed = await SdMailboxRepository.softDelete(id)
    if (!removed.ok) return removed

    audit('delete', actorId, workspaceId, id)
    return ok(undefined)
  },

  /** Testa IMAP (e SMTP, se houver) e grava o status da caixa. */
  async test(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<SdMailboxTestDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const existing = await loadOwned(workspaceId, id)
    if (!existing.ok) return existing

    const credentials = await decryptSdMailbox(existing.value)
    if (!credentials.ok) return credentials

    const result = await testConnections(
      credentials.value.imap,
      credentials.value.smtp,
    )
    const connected = result.error === null
    // Pausada continua pausada: o teste não religa a leitura sozinho.
    const status: SdMailboxStatus =
      existing.value.status === 'PAUSED'
        ? 'PAUSED'
        : connected
          ? 'ACTIVE'
          : 'ERROR'

    const saved = await SdMailboxRepository.update(id, {
      status,
      statusError: result.error,
    })
    if (!saved.ok) return saved

    audit('test', actorId, workspaceId, id, { meta: { connected } })
    logger.info('servicedesk.mailbox.tested', {
      workspaceId,
      mailboxId: id,
      connected,
    })
    return ok({
      connected,
      status,
      error: result.error,
      messages: result.messages,
      smtp: result.smtp,
    })
  },

  /**
   * E-mails trocados num chamado, para o histórico marcar de quem veio e
   * com que assunto. Mesma visibilidade do chamado (agente ou solicitante
   * dono) — a rota do chamado já é por id, número ou código.
   */
  async listTicketMail(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketMailMessageDTO[]>> {
    const scope = await loadSdTicketTab(actorId, workspaceId, ticketRef, 'VIEW')
    if (!scope.ok) return scope
    const rows = await SdMailMessageRepository.listByTicket(
      scope.value.ticket.id,
    )
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdTicketMailMessageDTO))
  },
}
