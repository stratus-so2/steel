import { z } from 'zod'
import { SdTicketTemplateDefaultsSchema } from '@/src/schemas/sd-ticket-template.schema'
import { dto } from '../../common'

/** DTOs dos chamados recorrentes (`types/sd-recurring-ticket.d.ts`). */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])
const Frequency = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
const RunStatus = z.enum(['CREATED', 'SKIPPED', 'FAILED'])

const named = z.object({ id: z.string(), name: z.string() })

export const SdRecurringTicketDTO = dto(
  'SdRecurringTicket',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string().meta({ example: 'Vistoria mensal do nobreak' }),
    description: z.string().nullable(),
    active: z.boolean().meta({
      description: 'Pausada (`false`) não tem próximo disparo.',
    }),
    ticketType: TicketType,
    templateId: z.string().nullable(),
    template: named.nullable(),
    defaults: SdTicketTemplateDefaultsSchema.meta({
      description:
        'Valores do chamado gerado, na mesma forma de `SdTicketTemplate.defaults`.',
    }),
    customerId: z.string().nullable(),
    customer: named.nullable(),
    configItemId: z.string().nullable(),
    configItem: named.extend({ code: z.string().nullable() }).nullable(),
    departmentId: z.string().nullable(),
    assigneeId: z.string().nullable(),
    frequency: Frequency,
    interval: z.number().int().meta({ example: 1 }),
    byWeekday: z.array(z.number().int()).meta({
      description: 'DAILY/WEEKLY: dias da semana (0 = domingo).',
    }),
    byMonthday: z.number().int().nullable().meta({
      description:
        'MONTHLY/YEARLY: dia do mês. Um dia que não existe no mês cai no último dia dele (31 → 30/04, 28/02).',
    }),
    atTime: z.string().meta({ example: '08:00' }),
    timezone: z.string().meta({ example: 'America/Sao_Paulo' }),
    startsAt: dateTime(),
    endsAt: nullableDateTime(),
    leadTimeMinutes: z.number().int().meta({
      description: 'Abre o chamado N minutos antes da ocorrência.',
    }),
    skipIfOpen: z.boolean(),
    lastRunAt: nullableDateTime(),
    nextRunAt: nullableDateTime().meta({
      description:
        'Quando o worker abre o próximo chamado (ocorrência − antecedência). `null` quando a rotina está pausada ou a vigência terminou.',
    }),
    upcoming: z.array(dateTime()).meta({
      description:
        'Próximas ocorrências (até 5), calculadas na leitura — é a pré-visualização da tela.',
    }),
    runCount: z.number().int(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdRecurringTicketRunDTO = dto(
  'SdRecurringTicketRun',
  z.object({
    id: z.string(),
    recurringId: z.string(),
    scheduledFor: dateTime().meta({
      description:
        'Momento agendado da ocorrência — com o `recurringId`, a trava de idempotência.',
    }),
    status: RunStatus,
    ticketId: z.string().nullable(),
    ticket: z
      .object({
        id: z.string(),
        number: z.number().int(),
        type: TicketType,
        title: z.string(),
      })
      .nullable(),
    reason: z.string().nullable().meta({
      description:
        'Por que pulou (ocorrência anterior aberta) ou falhou (código do erro).',
    }),
    createdAt: dateTime(),
  }),
)
