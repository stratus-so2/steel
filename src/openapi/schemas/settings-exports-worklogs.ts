import { z } from 'zod'

/**
 * DTOs de Ajustes › Exportações (`types/workspace-export.d.ts`) e Ajustes ›
 * Registros de trabalho (`types/worklog.d.ts`).
 */

const dateTime = () => z.iso.datetime()
const day = () =>
  z.string().meta({
    description: 'Dia no fuso do expediente (`AAAA-MM-DD`).',
    example: '2026-10-08',
  })
const ratio = () =>
  z
    .number()
    .nullable()
    .meta({ description: 'Razão 0–1 (4 casas); `null` sem denominador.' })

const Kind = z.enum(['DATA', 'LOGS'])

export const WorkspaceExportDTO = z.object({
  id: z.string(),
  kind: Kind,
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED']),
  requestedBy: z
    .object({ id: z.string(), name: z.string(), email: z.string() })
    .nullable(),
  periodFrom: dateTime().nullable(),
  periodTo: dateTime().nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  itemCount: z
    .number()
    .int()
    .nullable()
    .meta({ description: 'Tabelas (DATA) ou eventos (LOGS) no arquivo.' }),
  errorMessage: z.string().nullable(),
  createdAt: dateTime(),
  completedAt: dateTime().nullable(),
  expiresAt: dateTime().nullable(),
  downloadUrl: z.string().nullable().meta({
    description:
      'Rota autenticada de download; `null` fora de `COMPLETED` ou após expirar.',
  }),
})

export const WorkspaceExportOverviewDTO = z.object({
  items: z.array(WorkspaceExportDTO),
  availability: z.array(
    z.object({
      kind: Kind,
      available: z.boolean(),
      nextAvailableAt: dateTime().nullable(),
      configured: z.boolean().meta({
        description: 'LOGS: consulta ao Axiom configurada no servidor.',
      }),
    }),
  ),
  retentionDays: z.number().int(),
  logsPeriodDays: z.array(z.number().int()),
})

const Person = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
})

const Period = z.object({ from: day(), to: day(), timezone: z.string() })

export const WorklogListDTO = z.object({
  period: Period,
  items: z.array(
    z.object({
      id: z.string(),
      user: Person,
      ticket: z.object({ id: z.string(), code: z.string(), title: z.string() }),
      startedAt: dateTime(),
      endedAt: dateTime().nullable(),
      minutes: z.number().int(),
      billable: z.boolean(),
      source: z.enum(['TIMER', 'MANUAL']),
      amount: z.string().nullable(),
      description: z.string().nullable(),
    }),
  ),
  totals: z.object({
    entries: z.number().int(),
    minutes: z.number().int(),
    billableMinutes: z.number().int(),
    nonBillableMinutes: z.number().int(),
    timerMinutes: z.number().int(),
    manualMinutes: z.number().int(),
    amount: z.string(),
  }),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  canViewTeam: z.boolean(),
  people: z.array(Person).nullable(),
  serviceDeskEnabled: z.boolean(),
})

const IndicatorSet = z.object({
  serviceDesk: z
    .object({
      loggedMinutes: z.number().int(),
      businessMinutes: z.number().int(),
      utilization: ratio(),
      billableShare: ratio(),
      billedAmount: z.string(),
      ticketsResolved: z.number().int(),
      minutesPerResolvedTicket: z.number().int().nullable(),
      avgFirstResponseMinutes: z.number().int().nullable(),
      avgResolutionMinutes: z.number().int().nullable(),
      slaCompliance: ratio(),
      reopenRate: ratio(),
      timerShare: ratio(),
      daysWithoutEntries: z.number().nullable(),
      businessDays: z.number().int(),
    })
    .nullable(),
  crm: z
    .object({
      tasksCompleted: z.number().int(),
      opportunitiesWon: z.number().int(),
      wonAmount: z.string(),
    })
    .nullable(),
  communication: z
    .object({ conversationsHandled: z.number().int() })
    .nullable(),
})

const Comparison = { current: IndicatorSet, previous: IndicatorSet }
const weekValue = () => z.number().int().nullable()

export const ProductivityDTO = z.object({
  period: Period.extend({ previousFrom: day(), previousTo: day() }),
  calendar: z.object({
    source: z.enum(['workspace', 'standard']),
    name: z.string(),
  }),
  modules: z.object({
    serviceDesk: z.boolean(),
    crm: z.boolean(),
    communication: z.boolean(),
  }),
  canViewTeam: z.boolean(),
  team: z.object({ ...Comparison, people: z.number().int() }).nullable(),
  people: z.array(z.object({ ...Comparison, user: Person })),
  trend: z.array(
    z.object({
      weekStart: day(),
      loggedMinutes: weekValue(),
      ticketsResolved: weekValue(),
      tasksCompleted: weekValue(),
      opportunitiesWon: weekValue(),
      conversationsHandled: weekValue(),
    }),
  ),
})
