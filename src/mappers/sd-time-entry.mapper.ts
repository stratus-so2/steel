import type { SdRateWindow } from '@prisma/client'
import { sdMoney, sdSum } from '@/src/lib/servicedesk/money'
import type { SdContractWithRelations } from '@/src/repositories/sd-contract.repository'
import type { SdContractPeriodWithRelations } from '@/src/repositories/sd-contract-period.repository'
import type { SdTimeEntryWithRelations } from '@/src/repositories/sd-time-entry.repository'
import type {
  SdTimeEntryDTO,
  SdTimeEntryListDTO,
  SdTimeEntrySummaryDTO,
} from '@/types/sd-time-entry'
import { toSdContractPeriodDTO } from './sd-contract.mapper'

/** `SdTimeEntry` → DTO da aba "Horas" do chamado. */

export interface SdTimeEntryViewer {
  userId: string
  isAdmin: boolean
  /** O período do apontamento está fechado (congela a edição). */
  frozenPeriodIds?: Set<string>
}

/** Agente mexe no próprio apontamento com o período aberto; admin em todos. */
export function canEditSdTimeEntry(
  row: Pick<SdTimeEntryWithRelations, 'userId' | 'periodId'>,
  viewer: SdTimeEntryViewer,
): boolean {
  if (row.periodId && viewer.frozenPeriodIds?.has(row.periodId)) return false
  return viewer.isAdmin || row.userId === viewer.userId
}

export function toSdTimeEntryDTO(
  row: SdTimeEntryWithRelations,
  viewer: SdTimeEntryViewer,
): SdTimeEntryDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    contractId: row.contractId,
    periodId: row.periodId,
    source: row.source,
    user: row.user,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    minutes: row.minutes,
    billable: row.billable,
    window: row.window,
    amount: row.amount === null ? null : sdMoney(row.amount),
    description: row.description,
    editable: canEditSdTimeEntry(row, viewer),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function sdTimeEntrySummary(
  rows: Pick<
    SdTimeEntryWithRelations,
    'minutes' | 'billable' | 'window' | 'amount' | 'endedAt'
  >[],
): SdTimeEntrySummaryDTO {
  const closed = rows.filter((row) => row.endedAt !== null)
  const byWindow = new Map<SdRateWindow, number>()
  for (const row of closed) {
    byWindow.set(row.window, (byWindow.get(row.window) ?? 0) + row.minutes)
  }
  return {
    totalMinutes: closed.reduce((sum, row) => sum + row.minutes, 0),
    billableMinutes: closed
      .filter((row) => row.billable)
      .reduce((sum, row) => sum + row.minutes, 0),
    nonBillableMinutes: closed
      .filter((row) => !row.billable)
      .reduce((sum, row) => sum + row.minutes, 0),
    amount: sdMoney(sdSum(closed.map((row) => row.amount ?? 0))),
    byWindow: [...byWindow.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([window, minutes]) => ({ window, minutes })),
  }
}

export function toSdTimeEntryListDTO(input: {
  rows: SdTimeEntryWithRelations[]
  running: SdTimeEntryWithRelations | null
  contract: SdContractWithRelations | null
  period: SdContractPeriodWithRelations | null
  viewer: SdTimeEntryViewer
}): SdTimeEntryListDTO {
  return {
    items: input.rows.map((row) => toSdTimeEntryDTO(row, input.viewer)),
    summary: sdTimeEntrySummary(input.rows),
    running: input.running
      ? toSdTimeEntryDTO(input.running, input.viewer)
      : null,
    contract: input.contract
      ? {
          id: input.contract.id,
          name: input.contract.name,
          code: input.contract.code,
          includedMinutes: input.contract.includedMinutes,
          roundingMinutes: input.contract.roundingMinutes,
          minimumMinutes: input.contract.minimumMinutes,
          period: input.period ? toSdContractPeriodDTO(input.period) : null,
        }
      : null,
  }
}
