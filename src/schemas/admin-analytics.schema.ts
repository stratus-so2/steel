import { z } from 'zod'

/**
 * Contrato do painel Analytics do admin global (`/admin/analytics`,
 * `GET /api/admin/analytics`). Os dados vêm dos logs de requisição no Axiom
 * (ver docs/admin-analytics.md); a aba Jobs lê as filas BullMQ no Redis.
 */

export const ANALYTICS_VIEWS = [
  'overview',
  'routes',
  'route',
  'errors',
  'access',
  'jobs',
] as const
export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number]

export const ANALYTICS_RANGES = ['15m', '1h', '24h', '7d', '30d'] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

export const ANALYTICS_STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx'] as const
export type AnalyticsStatusClass = (typeof ANALYTICS_STATUS_CLASSES)[number]

export const ANALYTICS_ENVIRONMENTS = ['production', 'development'] as const
export type AnalyticsEnvironment = (typeof ANALYTICS_ENVIRONMENTS)[number]

/** Valor vazio na query string (`?route=`) vale como ausente. */
const blank = (v: unknown) => (v === '' || v === null ? undefined : v)

/**
 * Rota normalizada (`/api/workspaces/[id]/crm/leads`). Só caracteres de
 * caminho: o valor entra numa string APL (escapada de qualquer forma).
 */
export const AnalyticsRouteSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^\/[\w\-./[\]]*$/, 'Rota inválida')

export const AnalyticsQuerySchema = z.object({
  view: z.preprocess(blank, z.enum(ANALYTICS_VIEWS).default('overview')),
  range: z.preprocess(blank, z.enum(ANALYTICS_RANGES).default('1h')),
  workspace: z.preprocess(
    blank,
    z
      .string()
      .regex(/^[a-z0-9]{8,40}$/i, 'Workspace inválido')
      .optional(),
  ),
  route: z.preprocess(blank, AnalyticsRouteSchema.optional()),
  status: z.preprocess(blank, z.enum(ANALYTICS_STATUS_CLASSES).optional()),
  env: z.preprocess(blank, z.enum(ANALYTICS_ENVIRONMENTS).optional()),
})
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>
export type AnalyticsFilters = Omit<AnalyticsQuery, 'view'>

// ── Saída ────────────────────────────────────────────────────────────────

/** Painel independente: uma consulta que falha não derruba a página. */
export const panel = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: z.string() }),
  ])

export const AnalyticsSourceSchema = z.enum([
  'axiom',
  'fixtures',
  'unconfigured',
])
export type AnalyticsSource = z.infer<typeof AnalyticsSourceSchema>

export const AnalyticsMetaSchema = z.object({
  source: AnalyticsSourceSchema,
  range: z.enum(ANALYTICS_RANGES),
  /** Largura do balde das séries (`1m`, `15m`...). */
  bin: z.string(),
  binSeconds: z.number().int().positive(),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  generatedAt: z.iso.datetime(),
  /** Resposta veio do cache Redis (30–60 s). */
  cached: z.boolean(),
})
export type AnalyticsMeta = z.infer<typeof AnalyticsMetaSchema>

const count = () => z.number().int().nonnegative()
const ms = () => z.number().nonnegative().nullable()

export const TrafficPointSchema = z.object({
  t: z.iso.datetime(),
  requests: count(),
  /** Requisições por minuto no balde. */
  rpm: z.number().nonnegative(),
  errors4xx: count(),
  errors5xx: count(),
  p50: ms(),
  p95: ms(),
  p99: ms(),
})
export type TrafficPoint = z.infer<typeof TrafficPointSchema>

export const TrafficTotalsSchema = z.object({
  requests: count(),
  errors4xx: count(),
  errors5xx: count(),
  p50: ms(),
  p95: ms(),
  p99: ms(),
  users: count(),
  workspaces: count(),
})
export type TrafficTotals = z.infer<typeof TrafficTotalsSchema>

export const RouteStatSchema = z.object({
  route: z.string(),
  method: z.string(),
  requests: count(),
  errors4xx: count(),
  errors5xx: count(),
  p50: ms(),
  p95: ms(),
})
export type RouteStat = z.infer<typeof RouteStatSchema>

export const StatusCountSchema = z.object({
  status: z.number().int(),
  count: count(),
})
export type StatusCount = z.infer<typeof StatusCountSchema>

/** Linha de log de erro — sem IP, e-mail ou corpo; mensagem truncada. */
export const ErrorSampleSchema = z.object({
  t: z.iso.datetime(),
  method: z.string(),
  route: z.string(),
  status: z.number().int(),
  code: z.string().nullable(),
  message: z.string().nullable(),
  durationMs: ms(),
})
export type ErrorSample = z.infer<typeof ErrorSampleSchema>

export const ErrorGroupSchema = z.object({
  status: z.number().int(),
  code: z.string().nullable(),
  route: z.string(),
  message: z.string().nullable(),
  count: count(),
  lastSeen: z.iso.datetime(),
})
export type ErrorGroup = z.infer<typeof ErrorGroupSchema>

export const ErrorTrendPointSchema = z.object({
  t: z.iso.datetime(),
  errors4xx: count(),
  errors5xx: count(),
})
export type ErrorTrendPoint = z.infer<typeof ErrorTrendPointSchema>

export const ActivityPointSchema = z.object({
  t: z.iso.datetime(),
  users: count(),
  workspaces: count(),
})
export type ActivityPoint = z.infer<typeof ActivityPointSchema>

export const AccessTotalsSchema = z.object({
  users: count(),
  workspaces: count(),
  pageViews: count(),
})
export type AccessTotals = z.infer<typeof AccessTotalsSchema>

export const NamedCountSchema = z.object({ name: z.string(), count: count() })
export type NamedCount = z.infer<typeof NamedCountSchema>

export const CountryCountSchema = z.object({
  country: z.string(),
  countryCode: z.string().nullable(),
  count: count(),
})
export type CountryCount = z.infer<typeof CountryCountSchema>

export const CityCountSchema = z.object({
  city: z.string(),
  country: z.string(),
  count: count(),
})
export type CityCount = z.infer<typeof CityCountSchema>

export const QueueStatSchema = z.object({
  name: z.string(),
  waiting: count(),
  active: count(),
  delayed: count(),
  failed: count(),
  completed: count(),
})

export const JobFailureSchema = z.object({
  queue: z.string(),
  jobId: z.string().nullable(),
  jobName: z.string(),
  reason: z.string().nullable(),
  attempts: count(),
  failedAt: z.iso.datetime().nullable(),
})
export type JobFailure = z.infer<typeof JobFailureSchema>

export const AnalyticsOverviewSchema = z.object({
  view: z.literal('overview'),
  meta: AnalyticsMetaSchema,
  series: panel(z.array(TrafficPointSchema)),
  totals: panel(TrafficTotalsSchema),
})

export const AnalyticsRoutesSchema = z.object({
  view: z.literal('routes'),
  meta: AnalyticsMetaSchema,
  routes: panel(z.array(RouteStatSchema)),
})

export const AnalyticsRouteDetailSchema = z.object({
  view: z.literal('route'),
  meta: AnalyticsMetaSchema,
  route: z.string(),
  series: panel(z.array(TrafficPointSchema)),
  statuses: panel(z.array(StatusCountSchema)),
  recentErrors: panel(z.array(ErrorSampleSchema)),
})

export const AnalyticsErrorsSchema = z.object({
  view: z.literal('errors'),
  meta: AnalyticsMetaSchema,
  groups: panel(z.array(ErrorGroupSchema)),
  trend: panel(z.array(ErrorTrendPointSchema)),
  samples: panel(z.array(ErrorSampleSchema)),
})

export const AnalyticsAccessSchema = z.object({
  view: z.literal('access'),
  meta: AnalyticsMetaSchema,
  totals: panel(AccessTotalsSchema),
  activity: panel(z.array(ActivityPointSchema)),
  countries: panel(z.array(CountryCountSchema)),
  cities: panel(z.array(CityCountSchema)),
  browsers: panel(z.array(NamedCountSchema)),
  os: panel(z.array(NamedCountSchema)),
  devices: panel(z.array(NamedCountSchema)),
})

export const AnalyticsJobsSchema = z.object({
  view: z.literal('jobs'),
  meta: AnalyticsMetaSchema,
  queues: panel(z.array(QueueStatSchema)),
  failures: panel(z.array(JobFailureSchema)),
})

/** Sem `AXIOM_QUERY_TOKEN` (e sem fixtures): a página mostra o passo a passo. */
export const AnalyticsUnconfiguredSchema = z.object({
  view: z.enum(ANALYTICS_VIEWS),
  meta: AnalyticsMetaSchema,
  unconfigured: z.literal(true),
})

export const AnalyticsResultSchema = z.union([
  AnalyticsOverviewSchema,
  AnalyticsRoutesSchema,
  AnalyticsRouteDetailSchema,
  AnalyticsErrorsSchema,
  AnalyticsAccessSchema,
  AnalyticsJobsSchema,
  AnalyticsUnconfiguredSchema,
])

export type Panel<T> = { ok: true; data: T } | { ok: false; error: string }
export type AnalyticsOverviewDTO = z.infer<typeof AnalyticsOverviewSchema>
export type AnalyticsRoutesDTO = z.infer<typeof AnalyticsRoutesSchema>
export type AnalyticsRouteDetailDTO = z.infer<typeof AnalyticsRouteDetailSchema>
export type AnalyticsErrorsDTO = z.infer<typeof AnalyticsErrorsSchema>
export type AnalyticsAccessDTO = z.infer<typeof AnalyticsAccessSchema>
export type AnalyticsJobsDTO = z.infer<typeof AnalyticsJobsSchema>
export type AnalyticsUnconfiguredDTO = z.infer<
  typeof AnalyticsUnconfiguredSchema
>
export type AnalyticsResultDTO = z.infer<typeof AnalyticsResultSchema>
