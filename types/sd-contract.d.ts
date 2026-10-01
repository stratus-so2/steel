import type { SdTicketTypeDTO, SdUserSummaryDTO } from './sd-ticket'

export type SdContractStatusDTO = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ENDED'

export type SdContractBillingCycleDTO = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export type SdRateWindowDTO =
  | 'BUSINESS_HOURS'
  | 'AFTER_HOURS'
  | 'WEEKEND'
  | 'HOLIDAY'

export type SdContractPeriodStatusDTO = 'OPEN' | 'CLOSED'

export interface SdContractRateDTO {
  id: string
  /** `null` = qualquer tipo. */
  ticketType: SdTicketTypeDTO | null
  /** `null` = qualquer prioridade. */
  priorityId: string | null
  priorityName: string | null
  window: SdRateWindowDTO
  /** Decimal serializado (`"180.00"`). */
  hourlyRate: string
  /** Decimal serializado (`"1.50"`). */
  multiplier: string
  position: number
}

export interface SdContractPeriodDTO {
  id: string
  contractId: string
  /** ISO 8601 (início inclusivo, fim exclusivo). */
  periodStart: string
  periodEnd: string
  status: SdContractPeriodStatusDTO
  /** Franquia do período, já com o saldo acumulado. */
  includedMinutes: number
  usedMinutes: number
  billableMinutes: number
  overageMinutes: number
  carriedMinutes: number
  /** Decimal serializado (`"1250.00"`). */
  amount: string
  closedAt: string | null
  closedBy: SdUserSummaryDTO | null
  createdAt: string
  updatedAt: string
}

export interface SdContractCustomerSummaryDTO {
  id: string
  name: string
  tradeName: string | null
}

export interface SdContractDTO {
  id: string
  workspaceId: string
  customer: SdContractCustomerSummaryDTO | null
  name: string
  code: string | null
  status: SdContractStatusDTO
  startsAt: string
  endsAt: string | null
  billingCycle: SdContractBillingCycleDTO
  includedMinutes: number
  carryOver: boolean
  /** Decimal serializado (`"150.00"`). */
  hourlyRate: string
  overtimeRate: string | null
  roundingMinutes: number
  minimumMinutes: number
  /** Vazio = cobre todos os tipos. */
  ticketTypes: SdTicketTypeDTO[]
  slaPolicyId: string | null
  slaPolicyName: string | null
  notes: string | null
  rates: SdContractRateDTO[]
  /** Período aberto do ciclo corrente, quando já existe. */
  currentPeriod: SdContractPeriodDTO | null
  createdBy: SdUserSummaryDTO | null
  createdAt: string
  updatedAt: string
}

/** Contrato vigente de um cliente + consumo do período (tela do cliente). */
export interface SdContractSummaryDTO {
  contract: SdContractDTO | null
  period: SdContractPeriodDTO | null
  /** % da franquia consumida (`null` quando não há franquia). */
  percentUsed: number | null
}
