import { z } from 'zod'
import { dto } from '../common'

/** DTOs das telas Uso e Análises do Steel AI (`types/ai-usage.d.ts`). */

const dateTime = () => z.iso.datetime()
const day = () =>
  z
    .string()
    .meta({ description: 'Dia em UTC (`AAAA-MM-DD`).', example: '2026-10-07' })

const CumulativePoint = z.object({
  date: day(),
  mineUsd: z
    .number()
    .meta({ description: 'Gasto acumulado do usuário (US$).' }),
  workspaceUsd: z.number().meta({
    description: 'Gasto acumulado do espaço de trabalho inteiro (US$).',
  }),
})

const PeriodSummary = z.object({
  kind: z.enum(['week', 'month']),
  start: dateTime(),
  end: dateTime().meta({ description: 'Fim exclusivo (00:00 UTC).' }),
  days: z.number().int(),
  elapsedDays: z
    .number()
    .int()
    .meta({ description: 'Dias decorridos, incluindo hoje.' }),
  limitUsd: z.number().meta({
    description:
      'Valor disponível: a cota mensal do espaço (mês) ou a parcela semanal = cota × 7 ÷ dias do mês (semana). Não há limite por pessoa.',
  }),
  points: z.array(CumulativePoint),
  mineUsd: z.number(),
  workspaceUsd: z.number(),
  projectedMineUsd: z.number().meta({
    description: 'Projeção linear: média diária até hoje × dias do período.',
  }),
  projectedWorkspaceUsd: z.number(),
  previous: z.object({
    start: dateTime(),
    end: dateTime(),
    points: z.array(CumulativePoint),
    mineUsd: z.number(),
    workspaceUsd: z.number(),
    mineSamePointUsd: z.number().meta({
      description: 'Gasto do período anterior até o mesmo dia do período.',
    }),
    workspaceSamePointUsd: z.number(),
  }),
  mineChangePercent: z.number().nullable().meta({
    description:
      'Variação % contra o período anterior no mesmo ponto; `null` sem base.',
  }),
  workspaceChangePercent: z.number().nullable(),
})

export const AiUsageOverviewDTO = dto(
  'AiUsageOverview',
  z.object({
    timezone: z.literal('UTC'),
    generatedAt: dateTime(),
    monthlyQuotaUsd: z.number(),
    weeklyShareUsd: z.number(),
    month: PeriodSummary,
    week: PeriodSummary,
    canViewWorkspace: z.boolean().meta({
      description: 'OWNER/ADMIN: pode abrir a visão do espaço de trabalho.',
    }),
  }),
)

const Totals = {
  costUsd: z.number(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  calls: z.number().int(),
}

const BreakdownItem = z.object({
  key: z.string(),
  label: z.string().meta({ description: 'Nome em pt-BR.' }),
  detail: z.string().nullable(),
  share: z.number().meta({ description: 'Fração do gasto do período (0..1).' }),
  ...Totals,
})

export const AiUsageAnalyticsDTO = dto(
  'AiUsageAnalytics',
  z.object({
    scope: z.enum(['personal', 'workspace']),
    period: z.enum([
      'this_month',
      'last_month',
      'last_7_days',
      'last_30_days',
      'last_90_days',
      'custom',
    ]),
    timezone: z.literal('UTC'),
    from: dateTime(),
    to: dateTime().meta({ description: 'Fim exclusivo (00:00 UTC).' }),
    totals: z.object(Totals),
    daily: z.array(z.object({ date: day(), costUsd: z.number() })),
    byModel: z.array(BreakdownItem),
    byFeature: z.array(BreakdownItem),
    byModule: z.array(BreakdownItem).meta({
      description:
        'Escopo: `SERVICE_DESK`, `CRM`, `COMMUNICATION` ou `PLATFORM` (sem módulo).',
    }),
    byUser: z.array(BreakdownItem).nullable().meta({
      description: 'Só na visão `workspace`; `none` = automações sem usuário.',
    }),
    canViewWorkspace: z.boolean(),
  }),
)
