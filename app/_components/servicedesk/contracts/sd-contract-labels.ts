import type {
  SdContractBillingCycleDTO,
  SdContractPeriodStatusDTO,
  SdContractStatusDTO,
  SdRateWindowDTO,
} from '@/types/sd-contract'

import { SD_TONE } from '../sd-tone'

/** Rótulos e formatação (pt-BR) dos contratos e do apontamento de horas. */

export const SD_CONTRACT_STATUS_LABEL: Record<SdContractStatusDTO, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Vigente',
  SUSPENDED: 'Suspenso',
  ENDED: 'Encerrado',
}

/** Tons que funcionam igual no claro e no escuro (cor por transparência). */
export const SD_CONTRACT_STATUS_TONE: Record<SdContractStatusDTO, string> = {
  DRAFT: SD_TONE.slate,
  ACTIVE: SD_TONE.emerald,
  SUSPENDED: SD_TONE.amber,
  ENDED: SD_TONE.rose,
}

export const SD_BILLING_CYCLE_LABEL: Record<SdContractBillingCycleDTO, string> =
  {
    MONTHLY: 'Mensal',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  }

export const SD_RATE_WINDOW_LABEL: Record<SdRateWindowDTO, string> = {
  BUSINESS_HOURS: 'Expediente',
  AFTER_HOURS: 'Fora de hora',
  WEEKEND: 'Fim de semana',
  HOLIDAY: 'Feriado',
}

export const SD_PERIOD_STATUS_LABEL: Record<SdContractPeriodStatusDTO, string> =
  {
    OPEN: 'Aberto',
    CLOSED: 'Fechado',
  }

export const SD_CONTRACT_STATUS_OPTIONS = (
  Object.keys(SD_CONTRACT_STATUS_LABEL) as SdContractStatusDTO[]
).map((value) => ({ value, label: SD_CONTRACT_STATUS_LABEL[value] }))

export const SD_BILLING_CYCLE_OPTIONS = (
  Object.keys(SD_BILLING_CYCLE_LABEL) as SdContractBillingCycleDTO[]
).map((value) => ({ value, label: SD_BILLING_CYCLE_LABEL[value] }))

export const SD_RATE_WINDOW_OPTIONS = (
  Object.keys(SD_RATE_WINDOW_LABEL) as SdRateWindowDTO[]
).map((value) => ({ value, label: SD_RATE_WINDOW_LABEL[value] }))

/** `135` → `"2h15"`; `0` → `"0h"`. */
export function formatSdMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(Math.round(minutes))
  const hours = Math.floor(abs / 60)
  const rest = abs % 60
  if (rest === 0) return `${sign}${hours}h`
  return `${sign}${hours}h${String(rest).padStart(2, '0')}`
}

/** `"600 / 1200 min"` legível: `"10h de 20h"`. Franquia 0 = sob demanda. */
export function formatSdAllowance(used: number, included: number): string {
  if (included <= 0) return `${formatSdMinutes(used)} (sem franquia)`
  return `${formatSdMinutes(used)} de ${formatSdMinutes(included)}`
}
