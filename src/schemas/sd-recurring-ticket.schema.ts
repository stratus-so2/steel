import z from 'zod'
import { booleanQuery, sdDescription, sdId, sdName } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'
import { SdTicketTemplateDefaultsSchema } from './sd-ticket-template.schema'

/**
 * Chamados recorrentes / manutenção preventiva (`SdRecurringTicket`): a
 * agenda da rotina (frequência, intervalo, dias, horário, fuso, vigência e
 * antecedência) e os valores do chamado que será aberto — no mesmo formato
 * de `SdTicketTemplate.defaults`. As regras da agenda estão em
 * `src/lib/servicedesk/recurrence.ts`; autorização e vínculos no
 * `SdRecurringTicketService`.
 */

export const SD_RECURRENCE_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
] as const
export const SdRecurrenceFrequencyEnum = z.enum(SD_RECURRENCE_FREQUENCIES)

export const SD_RECURRING_RUN_STATUSES = [
  'CREATED',
  'SKIPPED',
  'FAILED',
] as const
export const SdRecurringRunStatusEnum = z.enum(SD_RECURRING_RUN_STATUSES)

/** `HH:MM` (00:00–23:59) — horário local do fuso da regra. */
const atTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)')

/** Fuso IANA (`America/Sao_Paulo`); a existência é checada no service. */
const timezone = z.string().trim().min(1, 'Fuso é obrigatório').max(64)

/** 0 = domingo … 6 = sábado. */
const weekday = z.number().int().min(0).max(6)

const interval = z.coerce.number().int().min(1).max(366)
const monthday = z.number().int().min(1).max(31).nullable().optional()
const leadTimeMinutes = z.coerce.number().int().min(0).max(43_200)

export const CreateSdRecurringTicketSchema = z.object({
  name: sdName,
  description: sdDescription,
  ticketType: SdTicketTypeEnum,
  templateId: sdId.nullable().optional(),
  /** Mesma forma de `SdTicketTemplate.defaults`. */
  defaults: SdTicketTemplateDefaultsSchema.default({}),
  customerId: sdId.nullable().optional(),
  configItemId: sdId.nullable().optional(),
  departmentId: sdId.nullable().optional(),
  assigneeId: sdId.nullable().optional(),
  frequency: SdRecurrenceFrequencyEnum.default('MONTHLY'),
  /** A cada N dias/semanas/meses/anos. */
  interval: interval.default(1),
  /** DAILY/WEEKLY: dias da semana. Ignorado em MONTHLY/YEARLY. */
  byWeekday: z.array(weekday).max(7).default([]),
  /** MONTHLY/YEARLY: dia do mês (31 cai no último dia de meses curtos). */
  byMonthday: monthday,
  atTime: atTime.default('08:00'),
  timezone: timezone.default('America/Sao_Paulo'),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  /** Abre o chamado N minutos antes da ocorrência (até 30 dias). */
  leadTimeMinutes: leadTimeMinutes.default(0),
  /** Não abre outra ocorrência enquanto a anterior estiver aberta. */
  skipIfOpen: z.boolean().default(true),
  active: z.boolean().default(true),
})
export type CreateSdRecurringTicketDTO = z.infer<
  typeof CreateSdRecurringTicketSchema
>

export const UpdateSdRecurringTicketSchema = z
  .object({
    name: sdName.optional(),
    description: sdDescription,
    templateId: sdId.nullable().optional(),
    defaults: SdTicketTemplateDefaultsSchema.optional(),
    customerId: sdId.nullable().optional(),
    configItemId: sdId.nullable().optional(),
    departmentId: sdId.nullable().optional(),
    assigneeId: sdId.nullable().optional(),
    frequency: SdRecurrenceFrequencyEnum.optional(),
    interval: interval.optional(),
    byWeekday: z.array(weekday).max(7).optional(),
    byMonthday: monthday,
    atTime: atTime.optional(),
    timezone: timezone.optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    leadTimeMinutes: leadTimeMinutes.optional(),
    skipIfOpen: z.boolean().optional(),
    /** `false` pausa a rotina (sem próximo disparo); `true` retoma. */
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdRecurringTicketDTO = z.infer<
  typeof UpdateSdRecurringTicketSchema
>

export const ListSdRecurringTicketsSchema = z.object({
  ticketType: SdTicketTypeEnum.optional(),
  /** Rotinas que incidem sobre um item de configuração (tela do CI). */
  configItemId: sdId.optional(),
  customerId: sdId.optional(),
  includeInactive: booleanQuery,
})
export type ListSdRecurringTicketsDTO = z.infer<
  typeof ListSdRecurringTicketsSchema
>

export const ListSdRecurringTicketRunsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
export type ListSdRecurringTicketRunsDTO = z.infer<
  typeof ListSdRecurringTicketRunsSchema
>
