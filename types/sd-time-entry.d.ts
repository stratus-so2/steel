import type { SdContractPeriodDTO, SdRateWindowDTO } from './sd-contract'
import type { SdUserSummaryDTO } from './sd-ticket'

export type SdTimeEntrySourceDTO = 'TIMER' | 'MANUAL'

export interface SdTimeEntryDTO {
  id: string
  ticketId: string
  contractId: string | null
  periodId: string | null
  source: SdTimeEntrySourceDTO
  user: SdUserSummaryDTO
  /** ISO 8601. `endedAt` nulo = cronômetro em andamento. */
  startedAt: string
  endedAt: string | null
  /** Minutos já arredondados pela regra do contrato. */
  minutes: number
  billable: boolean
  window: SdRateWindowDTO
  /** Decimal serializado (`"225.00"`); `null` sem contrato. */
  amount: string | null
  description: string | null
  /** Quem pode mexer: autor com o período aberto, ou admin do módulo. */
  editable: boolean
  createdAt: string
  updatedAt: string
}

export interface SdTimeEntrySummaryDTO {
  totalMinutes: number
  billableMinutes: number
  nonBillableMinutes: number
  /** Decimal serializado. */
  amount: string
  /** Minutos por janela, só as que têm apontamento. */
  byWindow: { window: SdRateWindowDTO; minutes: number }[]
}

export interface SdTimeEntryListDTO {
  items: SdTimeEntryDTO[]
  summary: SdTimeEntrySummaryDTO
  /** Cronômetro aberto de quem pediu (em qualquer chamado). */
  running: SdTimeEntryDTO | null
  /** Contrato carimbado no chamado, se houver. */
  contract: {
    id: string
    name: string
    code: string | null
    includedMinutes: number
    roundingMinutes: number
    minimumMinutes: number
    period: SdContractPeriodDTO | null
  } | null
}
