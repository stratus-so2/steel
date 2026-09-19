import type {
  AccessTotals,
  ActivityPoint,
  CityCount,
  CountryCount,
  ErrorGroup,
  ErrorSample,
  ErrorTrendPoint,
  NamedCount,
  RouteStat,
  StatusCount,
  TrafficPoint,
  TrafficTotals,
} from '@/src/schemas/admin-analytics.schema'
import type { AplFilters } from './apl'
import { bucketStarts, type TimeWindow } from './time-range'

/**
 * Dados simulados do painel Analytics (`ANALYTICS_FIXTURES=true`, só fora
 * de produção) para desenvolver e testar a UI sem o Axiom. Determinísticos
 * por balde de tempo + filtros (atualizar a página não "pula" os números),
 * com curva diária no fuso de São Paulo e menos tráfego no fim de semana.
 */

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** PRNG mulberry32 com semente. */
function rng(seed: string): () => number {
  let a = hash(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface RouteSpec {
  route: string
  method: string
  weight: number
  p50: number
  errorRate4xx: number
  errorRate5xx: number
  codes: [number, string, string][]
}

const ROUTES: RouteSpec[] = [
  {
    route: '/api/workspaces/[id]/crm/leads',
    method: 'GET',
    weight: 18,
    p50: 62,
    errorRate4xx: 0.01,
    errorRate5xx: 0.002,
    codes: [[403, 'FORBIDDEN', 'Sem permissão para ver leads']],
  },
  {
    route: '/api/workspaces/[id]/crm/leads',
    method: 'POST',
    weight: 4,
    p50: 118,
    errorRate4xx: 0.06,
    errorRate5xx: 0.004,
    codes: [
      [422, 'VALIDATION_ERROR', 'Dados inválidos'],
      [409, 'CRM_LEAD_DUPLICATE', 'Lead duplicado'],
    ],
  },
  {
    route: '/api/whatsapp/events',
    method: 'GET',
    weight: 14,
    p50: 35,
    errorRate4xx: 0.004,
    errorRate5xx: 0.001,
    codes: [[401, 'UNAUTHORIZED', 'Nao autenticado']],
  },
  {
    route: '/api/workspaces/[id]/whatsapp/conversations',
    method: 'GET',
    weight: 12,
    p50: 74,
    errorRate4xx: 0.005,
    errorRate5xx: 0.003,
    codes: [[403, 'MODULE_DISABLED', 'Módulo desabilitado']],
  },
  {
    route: '/api/workspaces/[id]/whatsapp/conversations/[id]/messages',
    method: 'POST',
    weight: 6,
    p50: 210,
    errorRate4xx: 0.02,
    errorRate5xx: 0.012,
    codes: [
      [
        502,
        'WHATSAPP_PROVIDER_ERROR',
        'Falha ao comunicar com o provedor do WhatsApp',
      ],
    ],
  },
  {
    route: '/api/whatsapp/webhook/meta',
    method: 'POST',
    weight: 9,
    p50: 22,
    errorRate4xx: 0.01,
    errorRate5xx: 0.001,
    codes: [[401, 'WHATSAPP_WEBHOOK_UNAUTHORIZED', 'Assinatura inválida']],
  },
  {
    route: '/api/auth/get-session',
    method: 'GET',
    weight: 16,
    p50: 12,
    errorRate4xx: 0,
    errorRate5xx: 0.0005,
    codes: [],
  },
  {
    route: '/api/auth/sign-in/email',
    method: 'POST',
    weight: 2,
    p50: 180,
    errorRate4xx: 0.12,
    errorRate5xx: 0.001,
    codes: [
      [401, 'INVALID_EMAIL_OR_PASSWORD', 'E-mail ou senha inválidos'],
      [429, 'RATE_LIMITED', 'Muitas tentativas'],
    ],
  },
  {
    route: '/api/workspaces/[id]/crm/opportunities',
    method: 'GET',
    weight: 7,
    p50: 88,
    errorRate4xx: 0.004,
    errorRate5xx: 0.002,
    codes: [[403, 'FORBIDDEN', 'Acesso negado']],
  },
  {
    route: '/api/workspaces/[id]/crm/ai/chat',
    method: 'POST',
    weight: 1.5,
    p50: 2400,
    errorRate4xx: 0.03,
    errorRate5xx: 0.02,
    codes: [
      [402, 'AI_QUOTA_EXCEEDED', 'Cota mensal de IA esgotada'],
      [503, 'AI_PROVIDER_UNAVAILABLE', 'Provedor de IA indisponível'],
    ],
  },
  {
    route: '/api/workspaces/[id]/crm/reports/[id]/run',
    method: 'POST',
    weight: 1.2,
    p50: 640,
    errorRate4xx: 0.01,
    errorRate5xx: 0.008,
    codes: [[500, 'DATABASE_ERROR', 'Falha ao executar o relatório']],
  },
  {
    route: '/api/users/me/preferences',
    method: 'PATCH',
    weight: 1,
    p50: 45,
    errorRate4xx: 0.02,
    errorRate5xx: 0,
    codes: [[422, 'VALIDATION_ERROR', 'Fuso horário inválido']],
  },
  {
    route: '/api/status/history',
    method: 'GET',
    weight: 2,
    p50: 30,
    errorRate4xx: 0,
    errorRate5xx: 0,
    codes: [],
  },
  {
    route: '/api/crm/forms/[id]/submit',
    method: 'POST',
    weight: 2.5,
    p50: 95,
    errorRate4xx: 0.05,
    errorRate5xx: 0.003,
    codes: [
      [404, 'CRM_FORM_NOT_FOUND', 'Formulário não encontrado'],
      [422, 'VALIDATION_ERROR', 'Campo obrigatório'],
    ],
  },
  {
    route: '/api/admin/overview',
    method: 'GET',
    weight: 0.4,
    p50: 140,
    errorRate4xx: 0,
    errorRate5xx: 0,
    codes: [],
  },
]
const TOTAL_WEIGHT = ROUTES.reduce((sum, r) => sum + r.weight, 0)

/** Requisições por minuto no pico (todas as rotas, sem filtro). */
const PEAK_RPM = 180

/** Fator da hora do dia (São Paulo, UTC-3) e do dia da semana. */
function loadFactor(date: Date): number {
  const local = new Date(date.getTime() - 3 * 3600_000)
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60
  const day = local.getUTCDay()
  const daily =
    0.08 + 0.92 * Math.max(0, Math.sin(((hour - 6) / 16) * Math.PI)) ** 1.4
  return daily * (day === 0 || day === 6 ? 0.35 : 1)
}

function routesFor(filters: AplFilters): RouteSpec[] {
  return filters.route
    ? ROUTES.filter((r) => r.route === filters.route)
    : ROUTES
}

/** Parcela do tráfego que sobra depois dos filtros de workspace/env. */
function scope(filters: AplFilters): number {
  let factor = 1
  if (filters.workspace) factor *= 0.12
  if (filters.env === 'development') factor *= 0.02
  if (filters.env === 'test') factor *= 0.05
  return factor
}

function statusShare(spec: RouteSpec, filters: AplFilters) {
  const ok = 1 - spec.errorRate4xx - spec.errorRate5xx
  switch (filters.status) {
    case '2xx':
      return { share: ok, e4: 0, e5: 0 }
    case '3xx':
      return { share: 0, e4: 0, e5: 0 }
    case '4xx':
      return { share: spec.errorRate4xx, e4: 1, e5: 0 }
    case '5xx':
      return { share: spec.errorRate5xx, e4: 0, e5: 1 }
    default:
      return { share: 1, e4: spec.errorRate4xx, e5: spec.errorRate5xx }
  }
}

const key = (filters: AplFilters) =>
  `${filters.env ?? ''}|${filters.workspace ?? ''}|${filters.route ?? ''}|${filters.status ?? ''}`

interface BucketSample {
  t: Date
  perRoute: { spec: RouteSpec; requests: number; e4: number; e5: number }[]
  users: number
  workspaces: number
  jitter: number
}

function sampleBucket(
  t: Date,
  window: TimeWindow,
  filters: AplFilters,
): BucketSample {
  const random = rng(`${t.toISOString()}|${key(filters)}`)
  const minutes = window.binSeconds / 60
  const load = loadFactor(t) * scope(filters)
  const perRoute = routesFor(filters).map((spec) => {
    const { share, e4, e5 } = statusShare(spec, filters)
    const expected =
      PEAK_RPM * minutes * load * (spec.weight / TOTAL_WEIGHT) * share
    const requests = Math.round(expected * (0.75 + random() * 0.5))
    return {
      spec,
      requests,
      // Com filtro de classe, todas as requisições da parcela são do tipo.
      e4: e4 === 1 ? requests : Math.round(requests * e4 * (0.5 + random())),
      e5:
        e5 === 1
          ? requests
          : Math.round(requests * e5 * (0.3 + random() * 1.4)),
    }
  })
  const activeUsers = Math.round(140 * load * (0.85 + random() * 0.3))
  return {
    t,
    perRoute,
    users: Math.min(
      activeUsers,
      Math.max(1, Math.round(activeUsers * Math.min(1, minutes / 20))),
    ),
    workspaces: Math.max(
      filters.workspace ? 1 : 0,
      Math.round(activeUsers * 0.3 * Math.min(1, minutes / 20)),
    ),
    jitter: random(),
  }
}

function samples(window: TimeWindow, filters: AplFilters): BucketSample[] {
  return bucketStarts(window).map((t) => sampleBucket(t, window, filters))
}

function latency(
  specs: { spec: RouteSpec; requests: number }[],
  jitter: number,
) {
  const total = specs.reduce((s, r) => s + r.requests, 0)
  if (total === 0) return { p50: null, p95: null, p99: null }
  const mean = specs.reduce((s, r) => s + r.spec.p50 * r.requests, 0) / total
  const p50 = Math.round(mean * (0.6 + jitter * 0.08))
  return {
    p50,
    p95: Math.round(p50 * (3.3 + jitter * 0.4)),
    p99: Math.round(p50 * (6.5 + jitter * 1.2)),
  }
}

export function fixtureTrafficSeries(
  window: TimeWindow,
  filters: AplFilters,
): TrafficPoint[] {
  const minutes = window.binSeconds / 60
  return samples(window, filters).map((bucket) => {
    const requests = bucket.perRoute.reduce((s, r) => s + r.requests, 0)
    return {
      t: bucket.t.toISOString(),
      requests,
      rpm: Math.round((requests / minutes) * 100) / 100,
      errors4xx: bucket.perRoute.reduce((s, r) => s + r.e4, 0),
      errors5xx: bucket.perRoute.reduce((s, r) => s + r.e5, 0),
      ...latency(bucket.perRoute, bucket.jitter),
    }
  })
}

export function fixtureTrafficTotals(
  window: TimeWindow,
  filters: AplFilters,
): TrafficTotals {
  const series = fixtureTrafficSeries(window, filters)
  const all = samples(window, filters)
  const requests = series.reduce((s, p) => s + p.requests, 0)
  const lat = latency(
    routesFor(filters).map((spec) => ({ spec, requests: spec.weight })),
    0.5,
  )
  const peakUsers = Math.max(0, ...all.map((b) => b.users))
  return {
    requests,
    errors4xx: series.reduce((s, p) => s + p.errors4xx, 0),
    errors5xx: series.reduce((s, p) => s + p.errors5xx, 0),
    ...(requests > 0 ? lat : { p50: null, p95: null, p99: null }),
    users: requests > 0 ? Math.round(peakUsers * 1.8) + 3 : 0,
    workspaces:
      requests > 0
        ? filters.workspace
          ? 1
          : Math.round(peakUsers * 0.35) + 2
        : 0,
  }
}

export function fixtureRoutes(
  window: TimeWindow,
  filters: AplFilters,
): RouteStat[] {
  const totals = new Map<
    RouteSpec,
    { requests: number; e4: number; e5: number }
  >()
  for (const bucket of samples(window, filters)) {
    for (const r of bucket.perRoute) {
      const acc = totals.get(r.spec) ?? { requests: 0, e4: 0, e5: 0 }
      acc.requests += r.requests
      acc.e4 += r.e4
      acc.e5 += r.e5
      totals.set(r.spec, acc)
    }
  }
  return [...totals.entries()]
    .filter(([, t]) => t.requests > 0)
    .map(([spec, t]) => ({
      route: spec.route,
      method: spec.method,
      requests: t.requests,
      errors4xx: t.e4,
      errors5xx: t.e5,
      p50: spec.p50,
      p95: Math.round(spec.p50 * 3.4),
    }))
    .sort((a, b) => b.requests - a.requests)
}

export function fixtureStatuses(
  window: TimeWindow,
  filters: AplFilters,
): StatusCount[] {
  const counts = new Map<number, number>()
  for (const route of fixtureRoutes(window, filters)) {
    const spec = ROUTES.find(
      (r) => r.route === route.route && r.method === route.method,
    ) as RouteSpec
    const ok = route.requests - route.errors4xx - route.errors5xx
    if (ok > 0) {
      counts.set(200, (counts.get(200) ?? 0) + Math.round(ok * 0.93))
      counts.set(201, (counts.get(201) ?? 0) + ok - Math.round(ok * 0.93))
    }
    const errorCodes =
      spec.codes.length > 0
        ? spec.codes
        : ([
            [500, 'INTERNAL_SERVER_ERROR', 'Erro interno'],
          ] as RouteSpec['codes'])
    const fours = errorCodes.filter(([s]) => s < 500)
    const fives = errorCodes.filter(([s]) => s >= 500)
    if (route.errors4xx > 0) {
      const status = (fours[0] ?? [400])[0]
      counts.set(status, (counts.get(status) ?? 0) + route.errors4xx)
    }
    if (route.errors5xx > 0) {
      const status = (fives[0] ?? [500])[0]
      counts.set(status, (counts.get(status) ?? 0) + route.errors5xx)
    }
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

export function fixtureErrorGroups(
  window: TimeWindow,
  filters: AplFilters,
): ErrorGroup[] {
  const groups: ErrorGroup[] = []
  for (const route of fixtureRoutes(window, filters)) {
    const spec = ROUTES.find(
      (r) => r.route === route.route && r.method === route.method,
    ) as RouteSpec
    for (const [status, code, message] of spec.codes) {
      const pool = status >= 500 ? route.errors5xx : route.errors4xx
      const same = spec.codes.filter(([s]) => s >= 500 === status >= 500).length
      const count = Math.round(pool / same)
      if (count > 0) {
        groups.push({
          status,
          code,
          route: route.route,
          message,
          count,
          lastSeen: new Date(
            window.to.getTime() - (hash(code + route.route) % 900) * 1000,
          ).toISOString(),
        })
      }
    }
  }
  return groups.sort((a, b) => b.count - a.count).slice(0, 50)
}

export function fixtureErrorSamples(
  window: TimeWindow,
  filters: AplFilters,
  limit = 30,
): ErrorSample[] {
  const groups = fixtureErrorGroups(window, filters)
  if (groups.length === 0) return []
  const random = rng(
    `samples|${window.to.toISOString().slice(0, 16)}|${key(filters)}`,
  )
  const span = window.to.getTime() - window.from.getTime()
  const out: ErrorSample[] = []
  for (
    let i = 0;
    i <
    Math.min(
      limit,
      groups.reduce((s, g) => s + g.count, 0),
    );
    i++
  ) {
    const group = groups[Math.floor(random() * Math.min(groups.length, 8))]
    const spec = ROUTES.find(
      (r) =>
        r.route === group.route && r.codes.some(([, c]) => c === group.code),
    ) as RouteSpec
    out.push({
      t: new Date(window.to.getTime() - random() * span * 0.5).toISOString(),
      method: spec.method,
      route: group.route,
      status: group.status,
      code: group.code,
      message: group.message,
      durationMs: Math.round(spec.p50 * (0.3 + random() * 2)),
    })
  }
  return out.sort((a, b) => b.t.localeCompare(a.t))
}

export function fixtureErrorTrend(
  window: TimeWindow,
  filters: AplFilters,
): ErrorTrendPoint[] {
  return fixtureTrafficSeries(window, filters).map(
    ({ t, errors4xx, errors5xx }) => ({ t, errors4xx, errors5xx }),
  )
}

export function fixtureActivity(
  window: TimeWindow,
  filters: AplFilters,
): ActivityPoint[] {
  return samples(window, filters).map((b) => ({
    t: b.t.toISOString(),
    users: b.users,
    workspaces: b.workspaces,
  }))
}

export function fixtureAccessTotals(
  window: TimeWindow,
  filters: AplFilters,
): AccessTotals {
  const totals = fixtureTrafficTotals(window, filters)
  return {
    users: totals.users,
    workspaces: totals.workspaces,
    pageViews: Math.round(totals.requests * 0.42),
  }
}

const CITIES: [string, string, string, number][] = [
  ['São Paulo', 'Brasil', 'BR', 34],
  ['Rio de Janeiro', 'Brasil', 'BR', 12],
  ['Belo Horizonte', 'Brasil', 'BR', 8],
  ['Curitiba', 'Brasil', 'BR', 7],
  ['Recife', 'Brasil', 'BR', 6],
  ['Porto Alegre', 'Brasil', 'BR', 5],
  ['Campinas', 'Brasil', 'BR', 4],
  ['Fortaleza', 'Brasil', 'BR', 4],
  ['Salvador', 'Brasil', 'BR', 3],
  ['Brasília', 'Brasil', 'BR', 3],
  ['Goiânia', 'Brasil', 'BR', 2],
  ['Florianópolis', 'Brasil', 'BR', 2],
  ['Lisboa', 'Portugal', 'PT', 2],
  ['Porto', 'Portugal', 'PT', 1],
  ['Miami', 'Estados Unidos', 'US', 1],
  ['Buenos Aires', 'Argentina', 'AR', 0.8],
  ['Santiago', 'Chile', 'CL', 0.5],
]

export function fixtureCities(
  window: TimeWindow,
  filters: AplFilters,
): CityCount[] {
  const views = fixtureAccessTotals(window, filters).pageViews
  const total = CITIES.reduce((s, c) => s + c[3], 0)
  return CITIES.map(([city, country, , weight]) => ({
    city,
    country,
    count: Math.round((views * 0.93 * weight) / total),
  }))
    .filter((c) => c.count > 0)
    .slice(0, 20)
}

export function fixtureCountries(
  window: TimeWindow,
  filters: AplFilters,
): CountryCount[] {
  const byCountry = new Map<string, CountryCount>()
  for (const city of fixtureCities(window, filters)) {
    const code = CITIES.find((c) => c[0] === city.city)?.[2] ?? null
    const acc = byCountry.get(city.country) ?? {
      country: city.country,
      countryCode: code,
      count: 0,
    }
    acc.count += city.count
    byCountry.set(city.country, acc)
  }
  return [...byCountry.values()].sort((a, b) => b.count - a.count)
}

function share(total: number, parts: [string, number][]): NamedCount[] {
  const sum = parts.reduce((s, [, w]) => s + w, 0)
  return parts
    .map(([name, w]) => ({ name, count: Math.round((total * w) / sum) }))
    .filter((p) => p.count > 0)
}

export function fixtureClients(
  window: TimeWindow,
  filters: AplFilters,
): { browsers: NamedCount[]; os: NamedCount[]; devices: NamedCount[] } {
  const views = fixtureAccessTotals(window, filters).pageViews
  return {
    browsers: share(views, [
      ['Chrome', 61],
      ['Safari', 17],
      ['Edge', 11],
      ['Firefox', 5],
      ['Samsung Internet', 4],
      ['Opera', 2],
    ]),
    os: share(views, [
      ['Windows', 46],
      ['Android', 21],
      ['macOS', 14],
      ['iOS', 15],
      ['Linux', 4],
    ]),
    devices: share(views, [
      ['Desktop', 63],
      ['Celular', 34],
      ['Tablet', 3],
    ]),
  }
}

export const FIXTURE_ROUTES = ROUTES.map((r) => r.route)
