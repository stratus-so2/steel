import { sdMoney } from '@/src/lib/servicedesk/money'
import type { SdContractWithRelations } from '@/src/repositories/sd-contract.repository'
import type { SdContractPeriodWithRelations } from '@/src/repositories/sd-contract-period.repository'
import type {
  SdContractDTO,
  SdContractPeriodDTO,
  SdContractRateDTO,
  SdContractSummaryDTO,
} from '@/types/sd-contract'

/** `SdContract` (+ regras, cliente e período aberto) → DTO da API. */

type RateRow = SdContractWithRelations['rates'][number]

export function toSdContractRateDTO(row: RateRow): SdContractRateDTO {
  return {
    id: row.id,
    ticketType: row.ticketType,
    priorityId: row.priorityId,
    priorityName: row.priority?.name ?? null,
    window: row.window,
    hourlyRate: sdMoney(row.hourlyRate),
    multiplier: sdMoney(row.multiplier),
    position: row.position,
  }
}

export function toSdContractPeriodDTO(
  row: SdContractPeriodWithRelations,
): SdContractPeriodDTO {
  return {
    id: row.id,
    contractId: row.contractId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    status: row.status,
    includedMinutes: row.includedMinutes,
    usedMinutes: row.usedMinutes,
    billableMinutes: row.billableMinutes,
    overageMinutes: row.overageMinutes,
    carriedMinutes: row.carriedMinutes,
    amount: sdMoney(row.amount),
    closedAt: row.closedAt?.toISOString() ?? null,
    closedBy: row.closedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSdContractDTO(row: SdContractWithRelations): SdContractDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    customer: row.customer,
    name: row.name,
    code: row.code,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    billingCycle: row.billingCycle,
    includedMinutes: row.includedMinutes,
    carryOver: row.carryOver,
    hourlyRate: sdMoney(row.hourlyRate),
    overtimeRate: row.overtimeRate === null ? null : sdMoney(row.overtimeRate),
    roundingMinutes: row.roundingMinutes,
    minimumMinutes: row.minimumMinutes,
    ticketTypes: row.ticketTypes,
    slaPolicyId: row.slaPolicyId,
    slaPolicyName: row.slaPolicy?.name ?? null,
    notes: row.notes,
    rates: row.rates.map(toSdContractRateDTO),
    currentPeriod: row.periods[0]
      ? toSdContractPeriodDTO(row.periods[0])
      : null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** % da franquia já consumida; `null` quando o contrato não tem franquia. */
export function sdPeriodPercentUsed(
  period: Pick<
    SdContractPeriodWithRelations,
    'includedMinutes' | 'billableMinutes'
  > | null,
): number | null {
  if (!period || period.includedMinutes <= 0) return null
  return Math.round((period.billableMinutes / period.includedMinutes) * 100)
}

export function toSdContractSummaryDTO(
  contract: SdContractWithRelations | null,
  period: SdContractPeriodWithRelations | null,
): SdContractSummaryDTO {
  return {
    contract: contract ? toSdContractDTO(contract) : null,
    period: period ? toSdContractPeriodDTO(period) : null,
    percentUsed: sdPeriodPercentUsed(period),
  }
}
