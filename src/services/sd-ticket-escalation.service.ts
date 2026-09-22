import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toSdTicketDTO } from '@/src/mappers/sd-ticket.mapper'
import { toSdTicketEscalationDTO } from '@/src/mappers/sd-ticket-event.mapper'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdTicketEscalationRepository } from '@/src/repositories/sd-ticket-escalation.repository'
import type { EscalateSdTicketDTO } from '@/src/schemas/sd-ticket-escalation.schema'
import type { SdTicketDTO, SdTicketEscalationDTO } from '@/types/sd-ticket'
import { SdAccess } from './sd-access'
import { runSdAutomations } from './sd-automation-engine'
import { SdTicketEngine, sdUserActor } from './sd-ticket-engine'
import { escalateSdTicket } from './sd-ticket-escalator'

export const SdTicketEscalationService = {
  /** Histórico de escalonamentos do chamado (só agentes). */
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketEscalationDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    const ticket = await SdTicketEngine.resolveRef(workspaceId, ticketRef)
    if (!ticket.ok) return ticket
    const rows = await SdTicketEscalationRepository.listByTicket(
      ticket.value.id,
    )
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdTicketEscalationDTO))
  },

  /** Escalonamento manual (funcional ou hierárquico), só agentes. */
  async escalate(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    input: EscalateSdTicketDTO,
  ): Promise<
    Result<{ ticket: SdTicketDTO; escalation: SdTicketEscalationDTO }>
  > {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'EDIT',
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

    const result = await escalateSdTicket(
      ticket.value,
      {
        kind: input.kind,
        toDepartmentId: input.toDepartmentId,
        toUserId: input.toUserId,
        reason: input.reason,
        notifyAssignee: true,
        notifyDepartmentLeads: input.kind === 'HIERARCHICAL',
      },
      sdUserActor(ctx.value),
      config.value,
    )
    if (!result.ok) return result
    auditMutation({
      entity: 'sd_ticket',
      action: 'escalate',
      actorId,
      targetId: ticket.value.id,
      meta: {
        workspaceId,
        kind: input.kind,
        toLevel: result.value.escalation.toLevel,
      },
    })

    let after = result.value.ticket
    const run = await runSdAutomations('TICKET_UPDATED', after.id, { actorId })
    if (run.ok && run.value.matched > 0) {
      const fresh = await SdTicketRepository.findById(after.id, workspaceId)
      if (fresh.ok) after = fresh.value
    }
    return ok({
      ticket: toSdTicketDTO(after, {
        prefixes: config.value.prefixes,
        atRiskPercent: config.value.settings.slaAtRiskPercent,
      }),
      escalation: toSdTicketEscalationDTO(result.value.escalation),
    })
  },
}
