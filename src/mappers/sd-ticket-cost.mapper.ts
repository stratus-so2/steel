import type { SdCostCategory } from '@prisma/client'
import { sdLineTotal, sdMoney, sdSum } from '@/src/lib/servicedesk/money'
import type { SdTicketCostWithRelations } from '@/src/repositories/sd-ticket-cost.repository'
import type {
  SdTicketCostDTO,
  SdTicketCostListDTO,
  SdTicketCostSummaryDTO,
} from '@/types/sd-ticket-cost'

export function toSdTicketCostDTO(
  row: SdTicketCostWithRelations,
): SdTicketCostDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    category: row.category,
    description: row.description,
    quantity: sdMoney(row.quantity),
    unitCost: sdMoney(row.unitCost),
    total: sdMoney(sdLineTotal(row.quantity, row.unitCost)),
    billable: row.billable,
    incurredAt: row.incurredAt.toISOString(),
    user: row.user,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function sdCostSummary(
  rows: Pick<
    SdTicketCostWithRelations,
    'category' | 'quantity' | 'unitCost' | 'billable'
  >[],
): SdTicketCostSummaryDTO {
  const lines = rows.map((row) => ({
    category: row.category,
    billable: row.billable,
    total: sdLineTotal(row.quantity, row.unitCost),
  }))
  const byCategory = new Map<SdCostCategory, ReturnType<typeof sdSum>>()
  for (const line of lines) {
    byCategory.set(
      line.category,
      sdSum([byCategory.get(line.category) ?? 0, line.total]),
    )
  }
  return {
    total: sdMoney(sdSum(lines.map((l) => l.total))),
    billable: sdMoney(
      sdSum(lines.filter((l) => l.billable).map((l) => l.total)),
    ),
    nonBillable: sdMoney(
      sdSum(lines.filter((l) => !l.billable).map((l) => l.total)),
    ),
    byCategory: [...byCategory.entries()]
      .sort((a, b) => b[1].comparedTo(a[1]))
      .map(([category, total]) => ({ category, total: sdMoney(total) })),
  }
}

export function toSdTicketCostListDTO(
  rows: SdTicketCostWithRelations[],
): SdTicketCostListDTO {
  return { items: rows.map(toSdTicketCostDTO), summary: sdCostSummary(rows) }
}
