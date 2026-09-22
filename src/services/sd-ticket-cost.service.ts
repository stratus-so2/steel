import { auditMutation } from '@/lib/axiom/audit'
import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { sdLineTotal, sdMoney } from '@/src/lib/servicedesk/money'
import {
  toSdTicketCostDTO,
  toSdTicketCostListDTO,
} from '@/src/mappers/sd-ticket-cost.mapper'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketCostRepository } from '@/src/repositories/sd-ticket-cost.repository'
import type {
  CreateSdTicketCostDTO,
  UpdateSdTicketCostDTO,
} from '@/src/schemas/sd-ticket-cost.schema'
import type {
  SdTicketCostDTO,
  SdTicketCostListDTO,
} from '@/types/sd-ticket-cost'
import { SdTicketEngine } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { loadSdTicketTab, publishSdTicketTab } from './sd-ticket-tab-support'

async function assertTechnician(
  workspaceId: string,
  userId: string | null | undefined,
): Promise<Result<void>> {
  if (!userId) return ok(undefined)
  const outsiders = await SdTicketContextRepository.findNonMembers(
    workspaceId,
    [userId],
  )
  if (!outsiders.ok) return outsiders
  if (outsiders.value.length > 0) {
    return err(validationError('Técnico não é membro do workspace'))
  }
  return ok(undefined)
}

/**
 * Custos do chamado (mão de obra, deslocamento, material…): só agentes;
 * nunca chegam a solicitantes (evento de tempo real `internal`).
 */
export const SdTicketCostService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketCostListDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope
    const rows = await SdTicketCostRepository.list(scope.value.ticket.id)
    if (!rows.ok) return rows
    return ok(toSdTicketCostListDTO(rows.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: CreateSdTicketCostDTO,
  ): Promise<Result<SdTicketCostDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value
    const technician = await assertTechnician(workspaceId, dto.userId)
    if (!technician.ok) return technician

    const created = await SdTicketCostRepository.create({
      workspaceId,
      ticketId: ticket.id,
      createdById: actorId,
      category: dto.category,
      description: dto.description,
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      billable: dto.billable,
      incurredAt: dto.incurredAt,
      userId: dto.userId ?? null,
    })
    if (!created.ok) return created
    const cost = created.value
    const total = sdMoney(sdLineTotal(cost.quantity, cost.unitCost))

    await SdTicketEngine.touchActivity(ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'cost.added',
      toValue: { id: cost.id, label: cost.description },
      meta: { category: cost.category, total, billable: cost.billable },
    })
    await publishSdTicketTab(ticket, 'ticket.cost', actorId, true)
    auditMutation({
      entity: 'sd_ticket_cost',
      action: 'create',
      actorId,
      targetId: cost.id,
      meta: { workspaceId, ticketId: ticket.id, total },
    })
    return ok(toSdTicketCostDTO(cost))
  },

  async update(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    costId: string,
    dto: UpdateSdTicketCostDTO,
  ): Promise<Result<SdTicketCostDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value
    const existing = await SdTicketCostRepository.findById(costId, ticket.id)
    if (!existing.ok) return existing
    const technician = await assertTechnician(workspaceId, dto.userId)
    if (!technician.ok) return technician

    const updated = await SdTicketCostRepository.update(costId, dto)
    if (!updated.ok) return updated
    const cost = updated.value
    const before = sdMoney(
      sdLineTotal(existing.value.quantity, existing.value.unitCost),
    )
    const after = sdMoney(sdLineTotal(cost.quantity, cost.unitCost))

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'cost.updated',
      toValue: { id: cost.id, label: cost.description },
      meta: { fields: Object.keys(dto), before, after },
    })
    await publishSdTicketTab(ticket, 'ticket.cost', actorId, true)
    auditMutation({
      entity: 'sd_ticket_cost',
      action: 'update',
      actorId,
      targetId: cost.id,
      meta: { workspaceId, ticketId: ticket.id, fields: Object.keys(dto) },
    })
    return ok(toSdTicketCostDTO(cost))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    costId: string,
  ): Promise<Result<void>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'DELETE',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value
    const existing = await SdTicketCostRepository.findById(costId, ticket.id)
    if (!existing.ok) return existing
    const removed = await SdTicketCostRepository.delete(costId)
    if (!removed.ok) return removed

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'cost.removed',
      fromValue: { id: costId, label: existing.value.description },
      meta: {
        total: sdMoney(
          sdLineTotal(existing.value.quantity, existing.value.unitCost),
        ),
      },
    })
    await publishSdTicketTab(ticket, 'ticket.cost', actorId, true)
    auditMutation({
      entity: 'sd_ticket_cost',
      action: 'delete',
      actorId,
      targetId: costId,
      meta: { workspaceId, ticketId: ticket.id },
    })
    return ok(undefined)
  },
}
