import type {
  SdPhaseCategoryDTO,
  SdTicketTypeDTO,
  SdUserSummaryDTO,
} from './sd-ticket'

/**
 * Calendário de mudanças do ServiceDesk: janelas de manutenção/congelamento
 * (`SdChangeWindow`) e as mudanças posicionadas pela janela planejada, com os
 * conflitos detectados.
 */

export type SdChangeWindowKindDTO = 'MAINTENANCE' | 'FREEZE'

export type SdChangeRecurrenceFreqDTO = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface SdChangeRecurrenceDTO {
  freq: SdChangeRecurrenceFreqDTO
  interval: number
  /** Só em `WEEKLY` (`mon`…`sun`); vazio = o dia da semana do início. */
  byDay: string[]
  /** Data final inclusiva (AAAA-MM-DD) ou `null`. */
  until: string | null
  /** Número máximo de ocorrências ou `null` (série aberta). */
  count: number | null
}

export interface SdChangeWindowDTO {
  id: string
  name: string
  kind: SdChangeWindowKindDTO
  startsAt: string
  endsAt: string
  recurrence: SdChangeRecurrenceDTO | null
  timezone: string
  /** Itens de configuração alvo; vazio = toda a workspace. */
  configItemIds: string[]
  /** Departamentos alvo; vazio = todos. */
  departmentIds: string[]
  description: string | null
  createdBy: SdUserSummaryDTO | null
  createdAt: string
  updatedAt: string
}

/** Uma ocorrência concreta da janela dentro do intervalo consultado. */
export interface SdChangeWindowOccurrenceDTO {
  windowId: string
  name: string
  kind: SdChangeWindowKindDTO
  startsAt: string
  endsAt: string
  timezone: string
  configItemIds: string[]
  departmentIds: string[]
  description: string | null
  /** `true` quando vem de uma repetição (não é a janela original). */
  recurring: boolean
}

/** Uma mudança agendada no calendário. */
export interface SdChangeCalendarEntryDTO {
  ticketId: string
  number: number
  code: string
  title: string
  type: SdTicketTypeDTO
  plannedStartAt: string
  plannedEndAt: string
  phaseName: string
  phaseCategory: SdPhaseCategoryDTO
  changeType: string | null
  changeRisk: string | null
  configItemId: string | null
  configItemName: string | null
  departmentId: string | null
  assignee: SdUserSummaryDTO | null
  /** Outras mudanças que disputam o mesmo item de configuração. */
  conflictTicketIds: string[]
  /** Janelas FREEZE que cobrem o período planejado. */
  frozenWindowIds: string[]
}

export interface SdChangeCalendarDTO {
  from: string
  to: string
  windows: SdChangeWindowOccurrenceDTO[]
  changes: SdChangeCalendarEntryDTO[]
}

export type SdChangeWarningKindDTO = 'FREEZE' | 'CONFLICT'

/** Aviso de agendamento — nunca bloqueia um admin que confirma. */
export interface SdChangeWarningDTO {
  kind: SdChangeWarningKindDTO
  message: string
  /** Janela de congelamento (`kind: 'FREEZE'`). */
  windowId: string | null
  windowName: string | null
  /** Mudança concorrente (`kind: 'CONFLICT'`). */
  ticketId: string | null
  ticketNumber: number | null
  ticketTitle: string | null
  startsAt: string
  endsAt: string
}

/** Bloco "agenda da mudança" da tela do chamado. */
export interface SdTicketChangeScheduleDTO {
  ticketId: string
  plannedStartAt: string | null
  plannedEndAt: string | null
  configItemId: string | null
  configItemName: string | null
  /** Janelas que cobrem (ou tocam) o período planejado. */
  windows: SdChangeWindowOccurrenceDTO[]
  warnings: SdChangeWarningDTO[]
}
