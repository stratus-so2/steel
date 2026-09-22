import { ok, type Result } from '@/src/lib/result'
import { toSdTicketEventDTO } from '@/src/mappers/sd-ticket-event.mapper'
import { SdTicketEventRepository } from '@/src/repositories/sd-ticket-event.repository'
import type { ListSdTicketEventsDTO } from '@/src/schemas/sd-ticket.schema'
import type { SdTicketEventPageDTO } from '@/types/sd-ticket'
import { SdAccess } from './sd-access'
import { SdTicketEngine } from './sd-ticket-engine'

export {
  recordSdTicketEvent,
  sdEventActorKind,
} from './sd-ticket-event-recorder'

export const SdTicketEventService = {
  /** Rastreabilidade do chamado (só agentes), mais recentes primeiro. */
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    query: ListSdTicketEventsDTO,
  ): Promise<Result<SdTicketEventPageDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx

    const ticket = await SdTicketEngine.resolveRef(workspaceId, ticketRef)
    if (!ticket.ok) return ticket

    const page = await SdTicketEventRepository.listByTicket(ticket.value.id, {
      cursor: query.cursor,
      limit: query.limit,
    })
    if (!page.ok) return page
    return ok({
      items: page.value.items.map(toSdTicketEventDTO),
      nextCursor: page.value.nextCursor,
    })
  },
}
