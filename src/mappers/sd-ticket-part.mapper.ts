import { sdLineTotal, sdMoney, sdSum } from '@/src/lib/servicedesk/money'
import type { SdTicketPartWithRelations } from '@/src/repositories/sd-ticket-part.repository'
import { SD_PART_TRANSITIONS } from '@/src/schemas/sd-ticket-part.schema'
import type {
  SdTicketPartDTO,
  SdTicketPartListDTO,
  SdTicketPartSummaryDTO,
} from '@/types/sd-ticket-part'

const INACTIVE = new Set(['CANCELED', 'RETURNED'])

export function toSdTicketPartDTO(
  row: SdTicketPartWithRelations,
): SdTicketPartDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    partId: row.partId,
    name: row.name,
    sku: row.sku,
    quantity: row.quantity,
    unitCost: sdMoney(row.unitCost),
    total: sdMoney(sdLineTotal(row.quantity, row.unitCost)),
    serialNumber: row.serialNumber,
    status: row.status,
    notes: row.notes,
    catalogStock: row.part?.stock ?? null,
    nextStatuses: [...SD_PART_TRANSITIONS[row.status]],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function sdPartSummary(
  rows: Pick<SdTicketPartWithRelations, 'status' | 'quantity' | 'unitCost'>[],
): SdTicketPartSummaryDTO {
  const active = rows.filter((r) => !INACTIVE.has(r.status))
  return {
    total: sdMoney(
      sdSum(active.map((r) => sdLineTotal(r.quantity, r.unitCost))),
    ),
    installed: sdMoney(
      sdSum(
        active
          .filter((r) => r.status === 'INSTALLED')
          .map((r) => sdLineTotal(r.quantity, r.unitCost)),
      ),
    ),
    count: active.length,
  }
}

export function toSdTicketPartListDTO(
  rows: SdTicketPartWithRelations[],
): SdTicketPartListDTO {
  return { items: rows.map(toSdTicketPartDTO), summary: sdPartSummary(rows) }
}
