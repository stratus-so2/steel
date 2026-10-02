import { z } from 'zod'
import { dto } from '../../common'

/** DTOs dos relatórios de SLA agendados (`types/sd-report.d.ts`). */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])
const Kind = z.enum(['SLA'])
const Format = z.enum(['PDF', 'CSV'])
const Period = z.enum([
  'LAST_MONTH',
  'LAST_WEEK',
  'CURRENT_MONTH',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
])
const RunStatus = z.enum(['GENERATED', 'SENT', 'FAILED'])

const named = z.object({ id: z.string(), name: z.string() })

const timerStats = z.object({
  measured: z.number().int().meta({
    description: 'Chamados com prazo que entraram na conta.',
  }),
  met: z.number().int(),
  breached: z.number().int(),
  compliance: z.number().nullable().meta({
    description: '% dentro do prazo (uma casa). `null` sem o que medir.',
  }),
  averageMinutes: z.number().int().nullable().meta({
    description: 'Tempo médio em **minutos úteis** do calendário do chamado.',
  }),
})

const breakdown = z.object({
  id: z.string().nullable().meta({
    description: '`null` = "sem departamento/cliente/prioridade".',
  }),
  label: z.string(),
  opened: z.number().int(),
  resolved: z.number().int(),
  breached: z.number().int(),
  compliance: z.number().nullable(),
  averageResolutionMinutes: z.number().int().nullable(),
})

export const SdReportSummaryDTO = dto(
  'SdReportSummary',
  z.object({
    periodStart: dateTime(),
    periodEnd: dateTime().meta({ description: 'Fim **exclusivo**.' }),
    volume: z.object({
      opened: z.number().int(),
      resolved: z.number().int(),
      closed: z.number().int(),
      openAtEnd: z.number().int().meta({
        description: 'Backlog no fim do período.',
      }),
    }),
    firstResponse: timerStats,
    resolution: timerStats.meta({
      description: '`averageMinutes` é o MTTR do período.',
    }),
    violations: z.array(
      z.object({
        ticketId: z.string(),
        number: z.number().int(),
        code: z.string().meta({ example: 'INC-000123' }),
        title: z.string(),
        customer: z.string().nullable(),
        kind: z.enum(['FIRST_RESPONSE', 'RESOLUTION']),
        dueAt: dateTime(),
        delayMinutes: z.number().int(),
      }),
    ),
    violationCount: z.number().int().meta({
      description: 'Total do período — a lista pode estar truncada.',
    }),
    csat: z.object({
      answered: z.number().int(),
      average: z.number().nullable(),
      distribution: z.array(
        z.object({ score: z.number().int(), count: z.number().int() }),
      ),
    }),
    byDepartment: z.array(breakdown),
    byCustomer: z.array(breakdown),
    byPriority: z.array(breakdown),
  }),
)

export const SdScheduledReportDTO = dto(
  'SdScheduledReport',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string().meta({ example: 'SLA mensal — clientes premium' }),
    kind: Kind,
    customerIds: z.array(z.string()).meta({
      description: 'Recorte de clientes; vazio = todos.',
    }),
    customers: z.array(named),
    departmentIds: z.array(z.string()),
    departments: z.array(named),
    ticketTypes: z.array(TicketType),
    period: Period,
    formats: z.array(Format),
    dayOfMonth: z.number().int().meta({ example: 1 }),
    atTime: z.string().meta({ example: '07:00' }),
    timezone: z.string().meta({ example: 'America/Sao_Paulo' }),
    recipients: z.array(z.string()),
    includeAccountOwners: z.boolean().meta({
      description:
        'Soma o e-mail de cada cliente do recorte e de quem mantém o cadastro.',
    }),
    active: z.boolean(),
    lastRunAt: nullableDateTime(),
    nextRunAt: nullableDateTime().meta({
      description:
        'Quando o worker vai gerar e enviar. `null` quando está pausado.',
    }),
    runCount: z.number().int(),
    createdById: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdReportRunDTO = dto(
  'SdReportRun',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    reportId: z.string().nullable(),
    reportName: z.string().nullable().meta({
      description: '`null` num relatório gerado sob demanda.',
    }),
    kind: Kind,
    status: RunStatus,
    periodStart: dateTime(),
    periodEnd: dateTime(),
    summary: SdReportSummaryDTO.nullable(),
    formats: z.array(Format).meta({
      description: 'Formatos realmente gravados — é o que dá para baixar.',
    }),
    recipients: z.array(z.string()),
    sentAt: nullableDateTime(),
    error: z.string().nullable(),
    requestedById: z.string().nullable(),
    requestedBy: named.nullable(),
    createdAt: dateTime(),
  }),
)
