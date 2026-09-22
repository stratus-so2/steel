import type {
  SdConfigItemStatusDTO,
  SdRiskLevelDTO,
} from '@/types/sd-config-item'
import type { SdCustomerKindDTO, SdPersonTypeDTO } from '@/types/sd-customer'
import type { SdLinkedTicketDTO } from '@/types/sd-directory'

export const SD_CUSTOMER_KIND_LABEL: Record<SdCustomerKindDTO, string> = {
  CLIENT: 'Cliente',
  COMPANY: 'Empresa',
}

export const SD_PERSON_TYPE_LABEL: Record<SdPersonTypeDTO, string> = {
  INDIVIDUAL: 'Pessoa física',
  LEGAL: 'Pessoa jurídica',
}

export const SD_CI_STATUS_LABEL: Record<SdConfigItemStatusDTO, string> = {
  PLANNED: 'Planejado',
  IN_STOCK: 'Em estoque',
  ACTIVE: 'Ativo',
  MAINTENANCE: 'Em manutenção',
  RETIRED: 'Aposentado',
}

export const SD_CI_STATUS_TONE: Record<SdConfigItemStatusDTO, string> = {
  PLANNED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  IN_STOCK: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  MAINTENANCE: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  RETIRED: 'bg-zinc-500/10 text-zinc-500',
}

export const SD_RISK_LABEL: Record<SdRiskLevelDTO, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  VERY_HIGH: 'Muito alta',
}

export const SD_RISK_TONE: Record<SdRiskLevelDTO, string> = {
  LOW: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  MEDIUM: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  HIGH: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  VERY_HIGH: 'bg-red-500/10 text-red-700 dark:text-red-300',
}

/** Prefixos padrão do ITIL (o workspace pode ter outros em SdSettings). */
export const SD_TICKET_PREFIX: Record<SdLinkedTicketDTO['type'], string> = {
  INCIDENT: 'INC',
  SERVICE_REQUEST: 'REQ',
  CHANGE: 'CHG',
  PROBLEM: 'PRB',
}

export const SD_TICKET_TYPE_LABEL: Record<SdLinkedTicketDTO['type'], string> = {
  INCIDENT: 'Incidente',
  SERVICE_REQUEST: 'Requisição',
  CHANGE: 'Mudança',
  PROBLEM: 'Problema',
}

export const UF_OPTIONS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

export function formatSdDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(iso),
  )
}
