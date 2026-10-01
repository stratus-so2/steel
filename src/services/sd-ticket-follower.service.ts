import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toSdTicketFollowerDTO } from '@/src/mappers/sd-notification.mapper'
import { SdNotificationRepository } from '@/src/repositories/sd-notification.repository'
import type { SdTicketFollowersDTO } from '@/types/sd-notification'
import {
  recordSdTicketEvent,
  sdEventActorKind,
} from './sd-ticket-event-recorder'
import { loadSdTicketTab } from './sd-ticket-tab-support'

/** Nome de quem seguiu, para a aba de rastreabilidade. */
async function actorLabel(
  workspaceId: string,
  actorId: string,
): Promise<string> {
  const found = await SdNotificationRepository.findRecipients(workspaceId, [
    actorId,
  ])
  return found.ok ? (found.value[0]?.name ?? actorId) : actorId
}

/**
 * "Seguir chamado" (`SdTicketFollower`): quem segue passa a receber os
 * eventos cujo público inclui `followers` no catálogo de notificações.
 * Cada um segue/para de seguir por si — não dá para inscrever outra pessoa
 * (para isso existem os participantes).
 *
 * Quem pode seguir é quem pode ver o chamado (`loadSdTicketTab`): agentes e
 * o solicitante/participante/contato do próprio chamado.
 */
export const SdTicketFollowerService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketFollowersDTO>> {
    const scope = await loadSdTicketTab(actorId, workspaceId, ticketRef, 'VIEW')
    if (!scope.ok) return scope

    const rows = await SdNotificationRepository.listFollowers(
      scope.value.ticket.id,
    )
    if (!rows.ok) return rows

    return ok({
      items: rows.value.map(toSdTicketFollowerDTO),
      following: rows.value.some((row) => row.userId === actorId),
    })
  },

  /** Idempotente: seguir de novo não duplica nem gera evento. */
  async follow(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketFollowersDTO>> {
    const scope = await loadSdTicketTab(actorId, workspaceId, ticketRef, 'EDIT')
    if (!scope.ok) return scope
    const { ticket } = scope.value

    const added = await SdNotificationRepository.addFollower(ticket.id, actorId)
    if (!added.ok) return added

    if (added.value) {
      await recordSdTicketEvent({
        workspaceId,
        ticketId: ticket.id,
        actorKind: sdEventActorKind(scope.value.actor),
        actorUserId: actorId,
        action: 'follower.added',
        toValue: { id: actorId, label: await actorLabel(workspaceId, actorId) },
      })
      auditMutation({
        entity: 'sd_ticket_follower',
        action: 'create',
        actorId,
        targetId: ticket.id,
        meta: { workspaceId, ticketId: ticket.id },
      })
    }

    return SdTicketFollowerService.list(actorId, workspaceId, ticketRef)
  },

  /** Idempotente: parar de seguir o que não seguia não é erro. */
  async unfollow(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketFollowersDTO>> {
    const scope = await loadSdTicketTab(actorId, workspaceId, ticketRef, 'EDIT')
    if (!scope.ok) return scope
    const { ticket } = scope.value

    const removed = await SdNotificationRepository.removeFollower(
      ticket.id,
      actorId,
    )
    if (!removed.ok) return removed

    if (removed.value) {
      await recordSdTicketEvent({
        workspaceId,
        ticketId: ticket.id,
        actorKind: sdEventActorKind(scope.value.actor),
        actorUserId: actorId,
        action: 'follower.removed',
        fromValue: {
          id: actorId,
          label: await actorLabel(workspaceId, actorId),
        },
      })
      auditMutation({
        entity: 'sd_ticket_follower',
        action: 'delete',
        actorId,
        targetId: ticket.id,
        meta: { workspaceId, ticketId: ticket.id },
      })
    }

    return SdTicketFollowerService.list(actorId, workspaceId, ticketRef)
  },
}
