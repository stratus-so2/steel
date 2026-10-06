import { createHash, randomBytes } from 'node:crypto'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import {
  sdApprovalExpired,
  sdApprovalNotPending,
  validationError,
} from '@/src/errors'
import { sendSdApprovalRequestEmail } from '@/src/lib/mail/servicedesk/send-sd-approval-request'
import { err, ok, type Result } from '@/src/lib/result'
import { sdNotifyTicketOf } from '@/src/lib/servicedesk/notify'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import {
  toSdPublicApprovalDTO,
  toSdTicketApprovalDTO,
} from '@/src/mappers/sd-ticket-approval.mapper'
import {
  type SdTicketApprovalCreateData,
  SdTicketApprovalRepository,
  type SdTicketApprovalWithRelations,
  type SdTicketApprovalWithTicket,
} from '@/src/repositories/sd-ticket-approval.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type {
  RequestSdTicketApprovalDTO,
  ResendSdTicketApprovalDTO,
  RespondSdApprovalDTO,
} from '@/src/schemas/sd-ticket-approval.schema'
import type {
  SdPublicApprovalDTO,
  SdTicketApprovalDTO,
} from '@/types/sd-ticket-approval'
import {
  notifySdApprovalCanceled,
  notifySdApprovalsExpired,
} from './sd-approval-notify'
import { registerSdRoundVote } from './sd-approval-round.service'
import { fireSdAutomations } from './sd-automation-engine'
import { notifySdEvent, type SdNotifyInput } from './sd-notification.service'
import { SdTicketEngine, sdTicketCode } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import {
  loadSdTicketTab,
  publishSdTicketTab,
  type SdTicketTabScope,
} from './sd-ticket-tab-support'

const DAY_MS = 24 * 60 * 60 * 1000

/** Notificar nunca derruba o fluxo da aprovação: falha vira log. */
async function notifyApproval(input: SdNotifyInput): Promise<void> {
  const sent = await notifySdEvent(input)
  if (!sent.ok) {
    logger.warn('servicedesk.approval.notify_failed', {
      workspaceId: input.workspaceId,
      ticketId: input.ticket.id,
      event: input.event,
      reason: sent.error.code,
    })
  }
}

const EXPIRES_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

/** Token do link (32 bytes, base64url) e o hash guardado no banco. */
export function newSdApprovalToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashSdApprovalToken(token) }
}

export function hashSdApprovalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sdApprovalUrl(token: string): string {
  return `${NEXT_PUBLIC_URL}/servicedesk/approval/${token}`
}

interface ResolvedApprover {
  userId: string | null
  email: string
  name: string | null
}

async function resolveApprovers(
  workspaceId: string,
  input: RequestSdTicketApprovalDTO['approvers'],
): Promise<Result<ResolvedApprover[]>> {
  const userIds = input.flatMap((a) => ('userId' in a ? [a.userId] : []))
  const outsiders = await SdTicketContextRepository.findNonMembers(
    workspaceId,
    userIds,
  )
  if (!outsiders.ok) return outsiders
  if (outsiders.value.length > 0) {
    return err(validationError('Aprovador não é membro do workspace'))
  }
  const users = await SdTicketContextRepository.findUserNames(userIds)
  if (!users.ok) return users

  const byEmail = new Map<string, ResolvedApprover>()
  for (const approver of input) {
    const resolved: ResolvedApprover =
      'userId' in approver
        ? {
            userId: approver.userId,
            email: (
              users.value.get(approver.userId)?.email ?? ''
            ).toLowerCase(),
            name: users.value.get(approver.userId)?.name ?? null,
          }
        : {
            userId: null,
            email: approver.email,
            name: approver.name ?? null,
          }
    if (!resolved.email) {
      return err(validationError('Aprovador sem e-mail cadastrado'))
    }
    if (!byEmail.has(resolved.email)) byEmail.set(resolved.email, resolved)
  }
  return ok([...byEmail.values()])
}

interface SdApprovalMailContext {
  workspaceId: string
  workspaceName: string
  requestedByName: string
  ticketCode: string
  ticketTitle: string
}

/** Envia o e-mail do pedido. Devolve `true` se saiu (ou dry-run). */
async function sendRequestEmail(
  mail: SdApprovalMailContext,
  approval: Pick<
    SdTicketApprovalWithRelations,
    'id' | 'approverEmail' | 'approverName' | 'message' | 'expiresAt'
  >,
  token: string,
): Promise<boolean> {
  const url = sdApprovalUrl(token)
  try {
    await sendSdApprovalRequestEmail({
      email: approval.approverEmail,
      approverName: approval.approverName,
      workspaceName: mail.workspaceName,
      ticketCode: mail.ticketCode,
      ticketTitle: mail.ticketTitle,
      requestedByName: mail.requestedByName,
      message: approval.message,
      expiresAtLabel: EXPIRES_FORMAT.format(approval.expiresAt),
      approveUrl: `${url}?decision=APPROVED`,
      rejectUrl: `${url}?decision=REJECTED`,
      reviewUrl: url,
    })
    return true
  } catch (error) {
    logger.warn('servicedesk.approval.email_failed', {
      workspaceId: mail.workspaceId,
      approvalId: approval.id,
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

async function mailContext(
  scope: SdTicketTabScope,
): Promise<SdApprovalMailContext> {
  const [users, workspace] = await Promise.all([
    SdTicketContextRepository.findUserNames([scope.ctx.userId]),
    SdTicketContextRepository.findWorkspace(scope.ticket.workspaceId),
  ])
  return {
    workspaceId: scope.ticket.workspaceId,
    workspaceName:
      (workspace.ok ? workspace.value?.name : undefined) ?? 'Steel',
    requestedByName:
      (users.ok ? users.value.get(scope.ctx.userId)?.name : undefined) ??
      'Um agente',
    ticketCode: scope.code,
    ticketTitle: scope.ticket.title,
  }
}

async function lazyExpire(
  scope: { ticketId: string } | { id: string },
): Promise<void> {
  const expired = await SdTicketApprovalRepository.expireOverdue(
    scope,
    new Date(),
  )
  if (!expired.ok) {
    logger.warn('servicedesk.approval.expire_failed', {
      reason: expired.error.code,
    })
    return
  }
  if (expired.value.length === 0) return
  await notifySdApprovalsExpired(
    expired.value.map((row) => ({
      workspaceId: row.workspaceId,
      ticketId: row.ticketId,
      requestedById: row.requestedById,
      label: row.approverName ?? row.approverEmail,
    })),
  )
}

async function publishApproval(
  ticket: { id: string; number: number; workspaceId: string },
  actorId: string | null,
): Promise<void> {
  await publishSdTicketEvent(ticket.workspaceId, {
    type: 'ticket.approval',
    ticketId: ticket.id,
    number: ticket.number,
    at: new Date().toISOString(),
    actorId,
    internal: true,
  })
}

async function loadByToken(
  token: string,
): Promise<Result<SdTicketApprovalWithTicket>> {
  const row = await SdTicketApprovalRepository.findByTokenHash(
    hashSdApprovalToken(token),
  )
  if (!row.ok) return row
  if (row.value.status === 'PENDING' && row.value.expiresAt <= new Date()) {
    await lazyExpire({ id: row.value.id })
    return ok({ ...row.value, status: 'EXPIRED' })
  }
  return row
}

async function publicCode(
  row: SdTicketApprovalWithTicket,
): Promise<Result<string>> {
  const config = await SdTicketEngine.loadConfig(row.workspaceId)
  if (!config.ok) return config
  return ok(sdTicketCode(row.ticket, config.value.prefixes))
}

/**
 * Aprovações por e-mail. Cada aprovador recebe um link próprio (token
 * aleatório, guardado só como SHA-256) para a página pública
 * `/servicedesk/approval/<token>`. **A primeira resposta decide** e cancela
 * os demais pedidos pendentes do chamado — assim o pedido mais recente não
 * cancelado (o que o motor lê para `requiresApproval`) é sempre a decisão.
 *
 * Expiração: **lazy** — pedidos PENDING vencidos viram EXPIRED ao listar,
 * ao abrir o link e ao responder (não há job; o motor já trata qualquer
 * status diferente de APPROVED como bloqueio).
 */
export const SdTicketApprovalService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketApprovalDTO[]>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope
    await lazyExpire({ ticketId: scope.value.ticket.id })
    const rows = await SdTicketApprovalRepository.list(scope.value.ticket.id)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdTicketApprovalDTO))
  },

  async request(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: RequestSdTicketApprovalDTO,
  ): Promise<Result<SdTicketApprovalDTO[]>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const scope = loaded.value
    const { ticket } = scope

    const approvers = await resolveApprovers(workspaceId, dto.approvers)
    if (!approvers.ok) return approvers

    const expiresAt = new Date(Date.now() + dto.expiresInDays * DAY_MS)
    const tokens = new Map<string, string>()
    const data: SdTicketApprovalCreateData[] = approvers.value.map((a) => {
      const { token, hash } = newSdApprovalToken()
      tokens.set(hash, token)
      return {
        workspaceId,
        ticketId: ticket.id,
        approverName: a.name,
        approverEmail: a.email,
        approverUserId: a.userId,
        tokenHash: hash,
        message: dto.message ?? null,
        requestedById: actorId,
        expiresAt,
      }
    })
    const created = await SdTicketApprovalRepository.createMany(data)
    if (!created.ok) return created

    const mail = await mailContext(scope)
    const sent: string[] = []
    for (const approval of created.value) {
      const delivered = await sendRequestEmail(
        mail,
        approval,
        tokens.get(approval.tokenHash) as string,
      )
      if (delivered) sent.push(approval.id)
    }
    const now = new Date()
    await SdTicketApprovalRepository.markSent(sent, now)

    await SdTicketEngine.touchActivity(ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'approval.requested',
      toValue: created.value.map((a) => ({
        id: a.id,
        label: a.approverName ?? a.approverEmail,
      })),
      meta: { expiresAt: expiresAt.toISOString(), sent: sent.length },
    })
    await notifyApproval({
      workspaceId,
      event: 'approval.requested',
      ticket: sdNotifyTicketOf(ticket, scope.code),
      actorId,
      audience: 'payload',
      payload: {
        title: `Aprovação pendente em ${scope.code}`,
        body: dto.message?.trim() || ticket.title,
        userIds: created.value.map((a) => a.approverUserId),
      },
    })
    await publishSdTicketTab(ticket, 'ticket.approval', actorId, true)
    auditMutation({
      entity: 'sd_ticket_approval',
      action: 'create',
      actorId,
      targetId: ticket.id,
      meta: { workspaceId, approvers: created.value.length, sent: sent.length },
    })
    const sentSet = new Set(sent)
    return ok(
      created.value.map((a) =>
        toSdTicketApprovalDTO({
          ...a,
          sentAt: sentSet.has(a.id) ? now : null,
        }),
      ),
    )
  },

  async cancel(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    approvalId: string,
  ): Promise<Result<SdTicketApprovalDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { agentOnly: true },
    )
    if (!loaded.ok) return loaded
    const { ticket, code } = loaded.value
    const existing = await SdTicketApprovalRepository.findById(
      approvalId,
      ticket.id,
    )
    if (!existing.ok) return existing
    await lazyExpire({ id: approvalId })
    const canceled = await SdTicketApprovalRepository.cancel(approvalId)
    if (!canceled.ok) return canceled
    if (!canceled.value) return err(sdApprovalNotPending())

    await notifySdApprovalCanceled({
      ticket,
      code,
      actorId,
      approverUserIds: [existing.value.approverUserId],
      body: existing.value.message?.trim() || ticket.title,
    })

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'approval.canceled',
      fromValue: {
        id: approvalId,
        label: existing.value.approverName ?? existing.value.approverEmail,
      },
    })
    await publishSdTicketTab(ticket, 'ticket.approval', actorId, true)
    auditMutation({
      entity: 'sd_ticket_approval',
      action: 'cancel',
      actorId,
      targetId: approvalId,
      meta: { workspaceId, ticketId: ticket.id },
    })
    return ok(toSdTicketApprovalDTO({ ...existing.value, status: 'CANCELED' }))
  },

  /** Novo link (token novo, validade renovada) para PENDING ou EXPIRED. */
  async resend(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    approvalId: string,
    dto: ResendSdTicketApprovalDTO,
  ): Promise<Result<SdTicketApprovalDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const scope = loaded.value
    const existing = await SdTicketApprovalRepository.findById(
      approvalId,
      scope.ticket.id,
    )
    if (!existing.ok) return existing
    if (!['PENDING', 'EXPIRED'].includes(existing.value.status)) {
      return err(sdApprovalNotPending())
    }

    const { token, hash } = newSdApprovalToken()
    const renewed = await SdTicketApprovalRepository.renewToken(approvalId, {
      tokenHash: hash,
      expiresAt: new Date(Date.now() + dto.expiresInDays * DAY_MS),
    })
    if (!renewed.ok) return renewed

    const delivered = await sendRequestEmail(
      await mailContext(scope),
      renewed.value,
      token,
    )
    const now = new Date()
    if (delivered) await SdTicketApprovalRepository.markSent([approvalId], now)

    await recordSdTicketEvent({
      workspaceId,
      ticketId: scope.ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'approval.resent',
      toValue: {
        id: approvalId,
        label: renewed.value.approverName ?? renewed.value.approverEmail,
      },
    })
    await publishSdTicketTab(scope.ticket, 'ticket.approval', actorId, true)
    auditMutation({
      entity: 'sd_ticket_approval',
      action: 'send',
      actorId,
      targetId: approvalId,
      meta: { workspaceId, ticketId: scope.ticket.id, delivered },
    })
    return ok(
      toSdTicketApprovalDTO({
        ...renewed.value,
        sentAt: delivered ? now : null,
      }),
    )
  },

  /** Resumo da página pública (sem sessão — o token é o acesso). */
  async publicPreview(token: string): Promise<Result<SdPublicApprovalDTO>> {
    const row = await loadByToken(token)
    if (!row.ok) return row
    const code = await publicCode(row.value)
    if (!code.ok) return code
    return ok(toSdPublicApprovalDTO(row.value, code.value))
  },

  /**
   * Resposta pelo link público. Registra a decisão, cancela os outros
   * pedidos pendentes, avisa quem pediu e o responsável e dispara
   * `APPROVAL_RESPONDED`.
   */
  async respond(
    token: string,
    dto: RespondSdApprovalDTO,
  ): Promise<Result<SdPublicApprovalDTO>> {
    const row = await loadByToken(token)
    if (!row.ok) return row
    const approval = row.value
    if (approval.status === 'EXPIRED') return err(sdApprovalExpired())
    if (approval.status !== 'PENDING') return err(sdApprovalNotPending())

    const at = new Date()
    const result = await SdTicketApprovalRepository.respond({
      id: approval.id,
      ticketId: approval.ticketId,
      status: dto.decision,
      comment: dto.comment ?? null,
      at,
      roundId: approval.roundId,
    })
    if (!result.ok) return result
    if (!result.value.responded) return err(sdApprovalNotPending())

    const code = await publicCode(approval)
    if (!code.ok) return code
    const { ticket } = approval
    const approved = dto.decision === 'APPROVED'
    const who = approval.approverName ?? approval.approverEmail

    await SdTicketEngine.touchActivity(ticket.id, at)
    await recordSdTicketEvent({
      workspaceId: approval.workspaceId,
      ticketId: ticket.id,
      actorKind: 'CONTACT',
      actorUserId: approval.approverUserId,
      action: 'approval.responded',
      field: 'approval',
      fromValue: 'PENDING',
      toValue: dto.decision,
      meta: {
        approvalId: approval.id,
        approver: who,
        comment: dto.comment ?? null,
        canceled: result.value.canceledIds.length,
      },
    })
    await notifyApproval({
      workspaceId: approval.workspaceId,
      event: 'approval.responded',
      ticket: sdNotifyTicketOf(ticket, code.value),
      actorId: approval.approverUserId,
      payload: {
        title: `${who} ${approved ? 'aprovou' : 'reprovou'} ${code.value}`,
        body: dto.comment?.trim() || ticket.title,
        userIds: [approval.requestedById],
      },
    })
    // Voto de uma rodada do comitê: reapura o quórum e fecha se der.
    if (approval.roundId) await registerSdRoundVote(approval.id)
    await publishApproval(ticket, approval.approverUserId)
    void fireSdAutomations('APPROVAL_RESPONDED', ticket.id, {
      actorId: approval.approverUserId,
    })
    auditMutation({
      entity: 'sd_ticket_approval',
      action: 'respond',
      actorId: approval.approverUserId,
      targetId: approval.id,
      meta: {
        workspaceId: approval.workspaceId,
        ticketId: ticket.id,
        decision: dto.decision,
      },
    })
    return ok(
      toSdPublicApprovalDTO(
        {
          ...approval,
          status: dto.decision,
          comment: dto.comment ?? null,
          respondedAt: at,
        },
        code.value,
      ),
    )
  },
}
