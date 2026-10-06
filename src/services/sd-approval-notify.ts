import { logger } from '@/lib/axiom/logger'
import { sdNotifyTicketOf } from '@/src/lib/servicedesk/notify'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import { notifySdEvent } from './sd-notification.service'
import { SdTicketEngine, sdTicketCode } from './sd-ticket-engine'

/**
 * Approval notices that the request/round flows share: canceled (to the
 * approvers that will no longer be asked) and expired (to the ticket assignee
 * and the agent who asked). Both go through `notifySdEvent`, so the SD
 * preferences and channels apply. Nothing here fails the caller.
 */

export interface SdApprovalExpiredItem {
  workspaceId: string
  ticketId: string
  /** Agent who asked for the approval. */
  requestedById: string
  /** Approver or committee shown in the notice. */
  label: string
}

/**
 * One `approval.expired` notice per ticket, listing what expired. System
 * event: there is no actor to exclude.
 */
export async function notifySdApprovalsExpired(
  items: SdApprovalExpiredItem[],
): Promise<void> {
  const byTicket = new Map<string, SdApprovalExpiredItem[]>()
  for (const item of items) {
    const list = byTicket.get(item.ticketId) ?? []
    list.push(item)
    byTicket.set(item.ticketId, list)
  }

  for (const [ticketId, group] of byTicket) {
    const workspaceId = group[0].workspaceId
    const warn = (reason: string) =>
      logger.warn('servicedesk.approval.expired_notify_failed', {
        workspaceId,
        ticketId,
        reason,
      })
    const [ticket, config] = await Promise.all([
      SdTicketRepository.findById(ticketId, workspaceId),
      SdTicketEngine.loadConfig(workspaceId),
    ])
    if (!ticket.ok) {
      warn(ticket.error.code)
      continue
    }
    if (!config.ok) {
      warn(config.error.code)
      continue
    }
    const code = sdTicketCode(ticket.value, config.value.prefixes)
    const labels = Array.from(new Set(group.map((item) => item.label)))
    const sent = await notifySdEvent({
      workspaceId,
      event: 'approval.expired',
      ticket: sdNotifyTicketOf(ticket.value, code),
      payload: {
        title: `Aprovação expirada em ${code}`,
        body: `Sem resposta de ${labels.join(', ')} dentro do prazo.`,
        userIds: group.map((item) => item.requestedById),
        meta: { expired: group.length },
      },
    })
    if (!sent.ok) warn(sent.error.code)
  }
}

/** `approval.canceled` to the approvers that had not answered yet. */
export async function notifySdApprovalCanceled(input: {
  ticket: SdTicketWithRelations
  code: string
  actorId: string
  approverUserIds: (string | null)[]
  body: string
}): Promise<void> {
  const userIds = input.approverUserIds.filter(
    (id): id is string => typeof id === 'string',
  )
  if (userIds.length === 0) return
  const sent = await notifySdEvent({
    workspaceId: input.ticket.workspaceId,
    event: 'approval.canceled',
    ticket: sdNotifyTicketOf(input.ticket, input.code),
    actorId: input.actorId,
    audience: 'payload',
    payload: {
      title: `Aprovação cancelada em ${input.code}`,
      body: input.body,
      userIds,
    },
  })
  if (!sent.ok) {
    logger.warn('servicedesk.approval.canceled_notify_failed', {
      workspaceId: input.ticket.workspaceId,
      ticketId: input.ticket.id,
      reason: sent.error.code,
    })
  }
}
