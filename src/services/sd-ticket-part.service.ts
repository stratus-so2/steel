import type { SdPart } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { sdPartStatusInvalid, validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toSdTicketPartDTO,
  toSdTicketPartListDTO,
} from '@/src/mappers/sd-ticket-part.mapper'
import { SdPartRepository } from '@/src/repositories/sd-part.repository'
import {
  type SdStockAdjustment,
  SdTicketPartRepository,
  type SdTicketPartWithRelations,
} from '@/src/repositories/sd-ticket-part.repository'
import {
  type CreateSdTicketPartDTO,
  canMoveSdPart,
  type UpdateSdTicketPartDTO,
} from '@/src/schemas/sd-ticket-part.schema'
import type {
  SdTicketPartDTO,
  SdTicketPartListDTO,
} from '@/types/sd-ticket-part'
import { SdTicketEngine } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { loadSdTicketTab, publishSdTicketTab } from './sd-ticket-tab-support'

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Solicitada',
  RESERVED: 'Reservada',
  INSTALLED: 'Instalada',
  RETURNED: 'Devolvida',
  CANCELED: 'Cancelada',
}

/** A peça do catálogo controla estoque? */
function tracksStock(row: Pick<SdTicketPartWithRelations, 'partId' | 'part'>) {
  return Boolean(row.partId && row.part && row.part.stock !== null)
}

function adjustment(
  workspaceId: string,
  partId: string,
  delta: number,
): SdStockAdjustment {
  return { workspaceId, partId, delta }
}

/**
 * Baixa/devolução de estoque numa mudança de status: entrar em INSTALLED
 * baixa a quantidade; INSTALLED → RETURNED devolve.
 */
function stockForUpdate(
  workspaceId: string,
  existing: SdTicketPartWithRelations,
  nextStatus: SdTicketPartWithRelations['status'],
  quantity: number,
): SdStockAdjustment | null {
  if (!tracksStock(existing)) return null
  const partId = existing.partId as string
  if (existing.status !== 'INSTALLED' && nextStatus === 'INSTALLED') {
    return adjustment(workspaceId, partId, -quantity)
  }
  if (existing.status === 'INSTALLED' && nextStatus === 'RETURNED') {
    return adjustment(workspaceId, partId, existing.quantity)
  }
  return null
}

/**
 * Peças usadas no chamado (catálogo `SdPart` ou texto livre), com o fluxo
 * solicitada → reservada → instalada → devolvida e baixa de estoque na
 * mesma transação. Só agentes.
 */
export const SdTicketPartService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketPartListDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope
    const rows = await SdTicketPartRepository.list(scope.value.ticket.id)
    if (!rows.ok) return rows
    return ok(toSdTicketPartListDTO(rows.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: CreateSdTicketPartDTO,
  ): Promise<Result<SdTicketPartDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value

    let catalog: SdPart | null = null
    if (dto.partId) {
      const found = await SdPartRepository.findById(dto.partId, workspaceId)
      if (!found.ok) return found
      if (!found.value.active) {
        return err(validationError('Esta peça está inativa no catálogo'))
      }
      catalog = found.value
    }

    const stock =
      catalog && catalog.stock !== null && dto.status === 'INSTALLED'
        ? adjustment(workspaceId, catalog.id, -dto.quantity)
        : null
    const created = await SdTicketPartRepository.create(
      {
        workspaceId,
        ticketId: ticket.id,
        createdById: actorId,
        partId: catalog?.id ?? null,
        name: dto.name ?? (catalog as SdPart).name,
        sku: dto.sku !== undefined ? dto.sku : (catalog?.sku ?? null),
        quantity: dto.quantity,
        unitCost: dto.unitCost ?? catalog?.unitCost.toFixed(2) ?? '0.00',
        serialNumber: dto.serialNumber ?? null,
        notes: dto.notes ?? null,
        status: dto.status,
      },
      stock,
    )
    if (!created.ok) return created
    const part = created.value

    await SdTicketEngine.touchActivity(ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'part.added',
      toValue: { id: part.id, label: part.name },
      meta: { quantity: part.quantity, status: part.status },
    })
    await publishSdTicketTab(ticket, 'ticket.part', actorId, true)
    auditMutation({
      entity: 'sd_ticket_part',
      action: 'create',
      actorId,
      targetId: part.id,
      meta: {
        workspaceId,
        ticketId: ticket.id,
        partId: part.partId,
        stockDelta: stock?.delta ?? 0,
      },
    })
    return ok(toSdTicketPartDTO(part))
  },

  async update(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    ticketPartId: string,
    dto: UpdateSdTicketPartDTO,
  ): Promise<Result<SdTicketPartDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value
    const existing = await SdTicketPartRepository.findById(
      ticketPartId,
      ticket.id,
    )
    if (!existing.ok) return existing
    const current = existing.value
    const nextStatus = dto.status ?? current.status

    if (!canMoveSdPart(current.status, nextStatus)) {
      return err(
        sdPartStatusInvalid(
          `Não é possível passar de ${STATUS_LABEL[current.status]} para ${STATUS_LABEL[nextStatus]}`,
        ),
      )
    }
    if (
      current.status === 'INSTALLED' &&
      dto.quantity !== undefined &&
      dto.quantity !== current.quantity
    ) {
      return err(
        validationError(
          'Peça instalada: devolva-a antes de alterar a quantidade',
        ),
      )
    }

    const stock = stockForUpdate(
      workspaceId,
      current,
      nextStatus,
      dto.quantity ?? current.quantity,
    )
    const updated = await SdTicketPartRepository.update(
      ticketPartId,
      dto,
      stock,
    )
    if (!updated.ok) return updated
    const part = updated.value
    const statusChanged = part.status !== current.status

    await SdTicketEngine.touchActivity(ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: statusChanged ? 'part.status_changed' : 'part.updated',
      field: statusChanged ? 'status' : null,
      fromValue: statusChanged ? current.status : null,
      toValue: statusChanged ? part.status : { id: part.id, label: part.name },
      meta: { partName: part.name, fields: Object.keys(dto) },
    })
    await publishSdTicketTab(ticket, 'ticket.part', actorId, true)
    auditMutation({
      entity: 'sd_ticket_part',
      action: 'update',
      actorId,
      targetId: part.id,
      meta: {
        workspaceId,
        ticketId: ticket.id,
        fields: Object.keys(dto),
        stockDelta: stock?.delta ?? 0,
      },
    })
    return ok(toSdTicketPartDTO(part))
  },

  /** Excluir peça instalada devolve a quantidade ao estoque. */
  async remove(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    ticketPartId: string,
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
    const existing = await SdTicketPartRepository.findById(
      ticketPartId,
      ticket.id,
    )
    if (!existing.ok) return existing
    const current = existing.value
    const stock =
      current.status === 'INSTALLED' && tracksStock(current)
        ? adjustment(workspaceId, current.partId as string, current.quantity)
        : null
    const removed = await SdTicketPartRepository.delete(ticketPartId, stock)
    if (!removed.ok) return removed

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'part.removed',
      fromValue: { id: ticketPartId, label: current.name },
    })
    await publishSdTicketTab(ticket, 'ticket.part', actorId, true)
    auditMutation({
      entity: 'sd_ticket_part',
      action: 'delete',
      actorId,
      targetId: ticketPartId,
      meta: { workspaceId, ticketId: ticket.id, stockDelta: stock?.delta ?? 0 },
    })
    return ok(undefined)
  },
}
