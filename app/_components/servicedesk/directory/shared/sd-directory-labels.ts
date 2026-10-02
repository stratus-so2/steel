import type {
  SdConfigItemStatusDTO,
  SdRiskLevelDTO,
} from '@/types/sd-config-item'
import type { SdCustomerKindDTO, SdPersonTypeDTO } from '@/types/sd-customer'
import type { SdLinkedTicketDTO } from '@/types/sd-directory'

import { SD_TONE, SD_TONE_TEXT } from '../../sd-tone'
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

/**
 * Tons de estado reaproveitados pelo diretório. Mapa fechado no formato do
 * repositório (`app/_components/notifications/notification-kind-icon.tsx`):
 * `bg-<c>-500/10 text-<c>-700 dark:text-<c>-300` tem contraste nos dois temas
 * e, escrito por inteiro aqui, é visível ao Tailwind. Estado neutro e estado
 * de erro usam token semântico (`muted`, `destructive`) — não têm cor própria.
 */
export const SD_STATE_TONE = {
  /** Positivo: registro ativo, importação concluída, garantia em dia. */
  ok: SD_TONE.emerald,
  /** Positivo sem superfície (texto e ícone). */
  okText: SD_TONE_TEXT.emerald,
  /** Atenção: vence em breve. */
  warn: SD_TONE.amber,
  /** Negativo: vencido, recusado. */
  bad: 'bg-destructive/10 text-destructive',
  /** Neutro: inativo, encerrado, sem informação. */
  neutral: 'bg-muted text-muted-foreground',
} as const

export const SD_CI_STATUS_TONE: Record<SdConfigItemStatusDTO, string> = {
  PLANNED: SD_TONE.sky,
  IN_STOCK: SD_TONE.slate,
  ACTIVE: SD_STATE_TONE.ok,
  MAINTENANCE: SD_STATE_TONE.warn,
  RETIRED: SD_STATE_TONE.neutral,
}

export const SD_RISK_LABEL: Record<SdRiskLevelDTO, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  VERY_HIGH: 'Muito alta',
}

export const SD_RISK_TONE: Record<SdRiskLevelDTO, string> = {
  LOW: SD_TONE.slate,
  MEDIUM: SD_TONE.sky,
  HIGH: SD_TONE.orange,
  VERY_HIGH: SD_STATE_TONE.bad,
}

export const SD_ACTIVE_LABEL: Record<'ACTIVE' | 'INACTIVE', string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
}

export const SD_ACTIVE_TONE: Record<'ACTIVE' | 'INACTIVE', string> = {
  ACTIVE: SD_STATE_TONE.ok,
  INACTIVE: SD_STATE_TONE.neutral,
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
