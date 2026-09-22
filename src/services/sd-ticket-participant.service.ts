import { auditMutation } from '@/lib/axiom/audit'
import { sdTicketForbidden, validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketParticipantRepository } from '@/src/repositories/sd-ticket-participant.repository'
import type { SdUserSummaryDTO } from '@/types/sd-ticket'
import { SdAccess, type SdAccessContext } from './sd-access'
import {
  type SdActor,
  type SdEngineConfig,
  SdTicketEngine,
  sdActorUserId,
  sdTicketCode,
  sdUserActor,
} from './sd-ticket-engine'
import {
  recordSdTicketEvent,
  sdEventActorKind,
} from './sd-ticket-event-recorder'
import { SdTicketNotifier } from './sd-ticket-notifier'
import { canViewSdTicket } from './sd-ticket-visibility'

function summaries(t: SdTicketWithRelations): SdUserSummaryDTO[] {
  return t.participants.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    email: p.user.email,
    image: p.user.image,
  }))
}

async function publishParticipants(
  t: SdTicketWithRelations,
  actor: SdActor,
): Promise<void> {
  await publishSdTicketEvent(
    t.workspaceId,
    {
      type: 'ticket.participants',
      ticketId: t.id,
      number: t.number,
      at: new Date().toISOString(),
      actorId: sdActorUserId(actor),
    },
    {
      requesterId: t.requesterId,
      participantIds: t.participants.map((p) => p.userId),
      contactUserId: t.contact?.userId ?? null,
    },
  )
}

/**
 * Adiciona participante (sem autorização — automação/serviço). O usuário
 * precisa ser membro do workspace. Notifica o participante e grava evento.
 */
export async function addSdTicketParticipant(
  ticket: SdTicketWithRelations,
  userId: string,
  actor: SdActor,
  config: SdEngineConfig,
): Promise<Result<SdTicketWithRelations>> {
  const outsiders = await SdTicketContextRepository.findNonMembers(
    ticket.workspaceId,
    [userId],
  )
  if (!outsiders.ok) return outsiders
  if (outsiders.value.length > 0) {
    return err(validationError('Usuário não é membro do workspace'))
  }
  const added = await SdTicketParticipantRepository.add(
    ticket.id,
    userId,
    sdActorUserId(actor),
  )
  if (!added.ok) return added
  if (!added.value) return ok(ticket)

  const fresh = await SdTicketRepository.findById(ticket.id, ticket.workspaceId)
  if (!fresh.ok) return fresh
  const label = fresh.value.participants.find((p) => p.userId === userId)?.user
    .name
  await recordSdTicketEvent({
    workspaceId: ticket.workspaceId,
    ticketId: ticket.id,
    actorKind: sdEventActorKind(actor),
    actorUserId: sdActorUserId(actor),
    action: 'participant.added',
    toValue: { id: userId, label: label ?? userId },
  })
  const code = sdTicketCode(ticket, config.prefixes)
  await SdTicketNotifier.notify({
    workspaceId: ticket.workspaceId,
    userIds: [userId],
    excludeUserIds: [sdActorUserId(actor)],
    kind: 'SD_TICKET_MESSAGE',
    ticket: { number: ticket.number, code, title: ticket.title },
    title: `Você agora participa de ${code}`,
    body: ticket.title,
  })
  await publishParticipants(fresh.value, actor)
  return ok(fresh.value)
}

async function loadTicket(
  actorId: string,
  workspaceId: string,
  ticketRef: string,
  action: 'VIEW' | 'EDIT',
): Promise<
  Result<{
    ctx: SdAccessContext
    config: SdEngineConfig
    ticket: SdTicketWithRelations
  }>
> {
  const ctx = await SdAccess.resolve(actorId, workspaceId, {
    resource: 'sd-tickets',
    action,
  })
  if (!ctx.ok) return ctx
  const config = await SdTicketEngine.loadConfig(workspaceId)
  if (!config.ok) return config
  const ticket = await SdTicketEngine.resolveRef(
    workspaceId,
    ticketRef,
    config.value.prefixes,
  )
  if (!ticket.ok) return ticket
  if (!canViewSdTicket(ctx.value, ticket.value)) return err(sdTicketForbidden())
  return ok({ ctx: ctx.value, config: config.value, ticket: ticket.value })
}

export const SdTicketParticipantService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdUserSummaryDTO[]>> {
    const loaded = await loadTicket(actorId, workspaceId, ticketRef, 'VIEW')
    if (!loaded.ok) return loaded
    return ok(summaries(loaded.value.ticket))
  },

  /** Agentes, ou o solicitante do próprio chamado. */
  async add(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    userId: string,
  ): Promise<Result<SdUserSummaryDTO[]>> {
    const loaded = await loadTicket(actorId, workspaceId, ticketRef, 'EDIT')
    if (!loaded.ok) return loaded
    const { ctx, config, ticket } = loaded.value
    if (!ctx.isAgent && ticket.requesterId !== actorId) {
      return err(
        sdTicketForbidden(
          'Só o solicitante ou um agente adiciona participantes',
        ),
      )
    }
    const result = await addSdTicketParticipant(
      ticket,
      userId,
      sdUserActor(ctx),
      config,
    )
    if (!result.ok) return result
    auditMutation({
      entity: 'sd_ticket',
      action: 'update',
      actorId,
      targetId: ticket.id,
      meta: { workspaceId, userId, op: 'participant_add' },
    })
    return ok(summaries(result.value))
  },

  /** Agentes, o solicitante do chamado ou o próprio participante (sair). */
  async remove(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    userId: string,
  ): Promise<Result<SdUserSummaryDTO[]>> {
    const loaded = await loadTicket(actorId, workspaceId, ticketRef, 'EDIT')
    if (!loaded.ok) return loaded
    const { ctx, ticket } = loaded.value
    if (!ctx.isAgent && ticket.requesterId !== actorId && userId !== actorId) {
      return err(sdTicketForbidden('Você não pode remover este participante'))
    }
    const removed = await SdTicketParticipantRepository.remove(
      ticket.id,
      userId,
    )
    if (!removed.ok) return removed
    if (!removed.value) return ok(summaries(ticket))

    const actor = sdUserActor(ctx)
    const label = ticket.participants.find((p) => p.userId === userId)?.user
      .name
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: sdEventActorKind(actor),
      actorUserId: actorId,
      action: 'participant.removed',
      fromValue: { id: userId, label: label ?? userId },
    })
    auditMutation({
      entity: 'sd_ticket',
      action: 'update',
      actorId,
      targetId: ticket.id,
      meta: { workspaceId, userId, op: 'participant_remove' },
    })
    const fresh = await SdTicketRepository.findById(ticket.id, workspaceId)
    if (!fresh.ok) return fresh
    await publishParticipants(ticket, actor)
    return ok(summaries(fresh.value))
  },
}
