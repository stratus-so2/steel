import type { SdTicketTemplateDefaults } from '@/src/schemas/sd-ticket-template.schema'
import type { SdTicketTypeDTO } from './sd-ticket'

/** Frequência da agenda de um chamado recorrente. */
export type SdRecurrenceFrequencyDTO = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

/** Desfecho de uma ocorrência: abriu, pulou ou falhou. */
export type SdRecurringRunStatusDTO = 'CREATED' | 'SKIPPED' | 'FAILED'

/**
 * Chamado recorrente (manutenção preventiva, rotina periódica): a agenda e
 * os valores do chamado gerado. `upcoming` são as próximas ocorrências
 * calculadas na hora da leitura (pré-visualização da tela), já respeitando
 * fuso, vigência e antecedência.
 */
export interface SdRecurringTicketDTO {
  id: string
  workspaceId: string
  name: string
  description: string | null
  active: boolean
  ticketType: SdTicketTypeDTO
  templateId: string | null
  template: { id: string; name: string } | null
  defaults: SdTicketTemplateDefaults
  customerId: string | null
  customer: { id: string; name: string } | null
  configItemId: string | null
  configItem: { id: string; name: string; code: string | null } | null
  departmentId: string | null
  assigneeId: string | null
  frequency: SdRecurrenceFrequencyDTO
  interval: number
  byWeekday: number[]
  byMonthday: number | null
  atTime: string
  timezone: string
  startsAt: string
  endsAt: string | null
  leadTimeMinutes: number
  skipIfOpen: boolean
  lastRunAt: string | null
  /** Quando o worker vai abrir o próximo chamado (ocorrência − antecedência). */
  nextRunAt: string | null
  /** Próximas ocorrências (ISO), em ordem — vazio quando a agenda terminou. */
  upcoming: string[]
  /** Ocorrências já registradas (abriu, pulou ou falhou). */
  runCount: number
  createdAt: string
  updatedAt: string
}

/** Uma ocorrência da rotina: o histórico de "abriu, pulou ou falhou". */
export interface SdRecurringTicketRunDTO {
  id: string
  recurringId: string
  /** Momento agendado da ocorrência (a trava de idempotência). */
  scheduledFor: string
  status: SdRecurringRunStatusDTO
  ticketId: string | null
  ticket: {
    id: string
    number: number
    type: SdTicketTypeDTO
    title: string
  } | null
  /** Por que pulou ou falhou (código do erro ou explicação em pt-BR). */
  reason: string | null
  createdAt: string
}
