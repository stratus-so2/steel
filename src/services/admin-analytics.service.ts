import { logger } from '@/lib/axiom/logger'
import { AnalyticsCache, analyticsCacheKey } from '@/src/cache/analytics.cache'
import { notFound, validationError } from '@/src/errors'
import { appError } from '@/src/errors/app-error'
import { APL, type AplFilters } from '@/src/lib/analytics/apl'
import { type AplRow, runApl } from '@/src/lib/analytics/axiom-query'
import {
  type AnalyticsConfig,
  resolveAnalyticsConfig,
} from '@/src/lib/analytics/config'
import * as fx from '@/src/lib/analytics/fixtures'
import { resolveWindow, type TimeWindow } from '@/src/lib/analytics/time-range'
import { getQueueHealth, getRecentJobFailures } from '@/src/lib/queue/health'
import { err, ok, type Result } from '@/src/lib/result'
import * as map from '@/src/mappers/admin-analytics.mapper'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import type {
  AccessTotals,
  ActivityPoint,
  AnalyticsMeta,
  AnalyticsQuery,
  AnalyticsResultDTO,
  AnalyticsSource,
  CityCount,
  CountryCount,
  ErrorGroup,
  ErrorSample,
  ErrorTrendPoint,
  NamedCount,
  Panel,
  RouteStat,
  StatusCount,
  TrafficPoint,
  TrafficTotals,
} from '@/src/schemas/admin-analytics.schema'
import { assertPlatformAdmin } from './authz'

type Clients = {
  browsers: NamedCount[]
  os: NamedCount[]
  devices: NamedCount[]
}

/** Fonte de dados de cada painel: Axiom (APL) ou fixtures (dev). */
interface AnalyticsProvider {
  series(): Promise<Result<TrafficPoint[]>>
  totals(): Promise<Result<TrafficTotals>>
  routes(): Promise<Result<RouteStat[]>>
  statuses(): Promise<Result<StatusCount[]>>
  errorSamples(limit: number): Promise<Result<ErrorSample[]>>
  errorGroups(): Promise<Result<ErrorGroup[]>>
  errorTrend(): Promise<Result<ErrorTrendPoint[]>>
  activity(): Promise<Result<ActivityPoint[]>>
  accessTotals(): Promise<Result<AccessTotals>>
  countries(): Promise<Result<CountryCount[]>>
  cities(): Promise<Result<CityCount[]>>
  clients(): Promise<Result<Clients>>
}

function axiomProvider(
  config: AnalyticsConfig,
  window: TimeWindow,
  filters: AplFilters,
): AnalyticsProvider {
  const options = { token: config.token as string, url: config.url }
  const ds = config.dataset
  const q = async <T>(
    apl: string,
    mapper: (rows: AplRow[]) => T,
  ): Promise<Result<T>> => {
    const rows = await runApl(apl, window, options)
    return rows.ok ? ok(mapper(rows.value)) : rows
  }
  return {
    series: () =>
      q(APL.trafficSeries(ds, filters, window.bin), (rows) =>
        map.toTrafficPoints(rows, window),
      ),
    totals: () => q(APL.trafficTotals(ds, filters), map.toTrafficTotals),
    routes: () => q(APL.routeStats(ds, filters), map.toRouteStats),
    statuses: () => q(APL.statusBreakdown(ds, filters), map.toStatusCounts),
    errorSamples: (limit) =>
      q(APL.errorSamples(ds, filters, limit), map.toErrorSamples),
    errorGroups: () => q(APL.errorGroups(ds, filters), map.toErrorGroups),
    errorTrend: () =>
      q(APL.errorTrend(ds, filters, window.bin), (rows) =>
        map.toErrorTrend(rows, window),
      ),
    activity: () =>
      q(APL.activity(ds, filters, window.bin), (rows) =>
        map.toActivity(rows, window),
      ),
    accessTotals: async () => {
      const [unique, views] = await Promise.all([
        runApl(APL.uniqueTotals(ds, filters), window, options),
        runApl(APL.pageViewTotal(ds, filters), window, options),
      ])
      if (!unique.ok) return unique
      if (!views.ok) return views
      return ok(map.toAccessTotals(unique.value, views.value))
    },
    countries: () => q(APL.countries(ds, filters), map.toCountries),
    cities: () => q(APL.cities(ds, filters), map.toCities),
    clients: () => q(APL.clients(ds, filters), map.toClientBreakdown),
  }
}

function fixtureProvider(
  window: TimeWindow,
  filters: AplFilters,
): AnalyticsProvider {
  const f = <T>(fn: () => T) => Promise.resolve(ok(fn()))
  return {
    series: () => f(() => fx.fixtureTrafficSeries(window, filters)),
    totals: () => f(() => fx.fixtureTrafficTotals(window, filters)),
    routes: () => f(() => fx.fixtureRoutes(window, filters)),
    statuses: () => f(() => fx.fixtureStatuses(window, filters)),
    errorSamples: (limit) =>
      f(() => fx.fixtureErrorSamples(window, filters, limit)),
    errorGroups: () => f(() => fx.fixtureErrorGroups(window, filters)),
    errorTrend: () => f(() => fx.fixtureErrorTrend(window, filters)),
    activity: () => f(() => fx.fixtureActivity(window, filters)),
    accessTotals: () => f(() => fx.fixtureAccessTotals(window, filters)),
    countries: () => f(() => fx.fixtureCountries(window, filters)),
    cities: () => f(() => fx.fixtureCities(window, filters)),
    clients: () => f(() => fx.fixtureClients(window, filters)),
  }
}

async function toPanel<T>(
  view: string,
  name: string,
  pending: Promise<Result<T>>,
): Promise<Panel<T>> {
  const result = await pending
  if (result.ok) return { ok: true, data: result.value }
  logger.warn('admin_analytics.panel_failed', {
    view,
    panel: name,
    code: result.error.code,
    message: result.error.message,
  })
  return { ok: false, error: result.error.message }
}

async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn())
  } catch (cause) {
    return err(
      appError(
        'INTERNAL_SERVER_ERROR',
        cause instanceof Error ? cause.message : 'Falha ao ler as filas',
      ),
    )
  }
}

function hasFailedPanel(result: AnalyticsResultDTO): boolean {
  return Object.values(result).some(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      'ok' in value &&
      value.ok === false,
  )
}

async function buildView(
  query: AnalyticsQuery,
  meta: AnalyticsMeta,
  provider: AnalyticsProvider,
): Promise<AnalyticsResultDTO> {
  const p = <T>(name: string, pending: Promise<Result<T>>) =>
    toPanel(query.view, name, pending)

  switch (query.view) {
    case 'routes':
      return {
        view: 'routes',
        meta,
        routes: await p('routes', provider.routes()),
      }
    case 'route': {
      const [series, statuses, recentErrors] = await Promise.all([
        p('series', provider.series()),
        p('statuses', provider.statuses()),
        p('recentErrors', provider.errorSamples(20)),
      ])
      return {
        view: 'route',
        meta,
        route: query.route as string,
        series,
        statuses,
        recentErrors,
      }
    }
    case 'errors': {
      const [groups, trend, samples] = await Promise.all([
        p('groups', provider.errorGroups()),
        p('trend', provider.errorTrend()),
        p('samples', provider.errorSamples(30)),
      ])
      return { view: 'errors', meta, groups, trend, samples }
    }
    case 'access': {
      const [totals, activity, countries, cities, clients] = await Promise.all([
        p('totals', provider.accessTotals()),
        p('activity', provider.activity()),
        p('countries', provider.countries()),
        p('cities', provider.cities()),
        p('clients', provider.clients()),
      ])
      const pick = (key: keyof Clients): Panel<NamedCount[]> =>
        clients.ok ? { ok: true, data: clients.data[key] } : clients
      return {
        view: 'access',
        meta,
        totals,
        activity,
        countries,
        cities,
        browsers: pick('browsers'),
        os: pick('os'),
        devices: pick('devices'),
      }
    }
    default: {
      const [series, totals] = await Promise.all([
        p('series', provider.series()),
        p('totals', provider.totals()),
      ])
      return { view: 'overview', meta, series, totals }
    }
  }
}

/**
 * Painel Analytics do admin global (`/admin/analytics`). Lê os logs de
 * requisição no Axiom (APL, src/lib/analytics/apl.ts) — ou fixtures em dev —
 * com as consultas de cada aba em paralelo, cache Redis de 45 s e erro por
 * painel. A aba Jobs lê as filas BullMQ direto do Redis.
 */
export const AdminAnalyticsService = {
  async get(
    actorId: string,
    query: AnalyticsQuery,
    now: Date = new Date(),
    config: AnalyticsConfig = resolveAnalyticsConfig(),
  ): Promise<Result<AnalyticsResultDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    if (query.view === 'route' && !query.route) {
      return err(validationError('Informe a rota para o detalhe'))
    }

    const window = resolveWindow(query.range, now)
    const meta = (source: AnalyticsSource): AnalyticsMeta => ({
      source,
      range: query.range,
      bin: window.bin,
      binSeconds: window.binSeconds,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      generatedAt: now.toISOString(),
      cached: false,
    })

    if (query.view === 'jobs') {
      const [queues, failures] = await Promise.all([
        toPanel(
          'jobs',
          'queues',
          safe(() => getQueueHealth()),
        ),
        toPanel(
          'jobs',
          'failures',
          safe(() => getRecentJobFailures()),
        ),
      ])
      return ok({
        view: 'jobs',
        meta: meta(config.source),
        queues,
        failures,
      })
    }

    if (config.source === 'unconfigured') {
      return ok({
        view: query.view,
        meta: meta('unconfigured'),
        unconfigured: true,
      })
    }

    const filters: AplFilters = {
      env: query.env,
      workspace: query.workspace,
      route: query.route,
      status: query.status,
    }
    if (query.workspace && query.view === 'access') {
      const workspace = await WorkspaceRepository.findById(query.workspace)
      if (!workspace.ok) {
        return workspace.error.code === 'RESOURCE_NOT_FOUND'
          ? err(notFound('Workspace'))
          : workspace
      }
      filters.workspaceSlug = workspace.value.slug
    }

    const cacheKey = analyticsCacheKey({
      source: config.source,
      dataset: config.dataset,
      view: query.view,
      range: query.range,
      workspace: query.workspace,
      route: query.route,
      status: query.status,
      env: query.env,
    })
    if (config.source === 'axiom') {
      const hit = await AnalyticsCache.get(cacheKey)
      if (hit) return ok({ ...hit, meta: { ...hit.meta, cached: true } })
    }

    const provider =
      config.source === 'axiom'
        ? axiomProvider(config, window, filters)
        : fixtureProvider(window, filters)
    const result = await buildView(query, meta(config.source), provider)
    const failed = hasFailedPanel(result)

    if (config.source === 'axiom' && !failed) {
      await AnalyticsCache.set(cacheKey, result)
    }

    logger.info('admin_analytics.view_built', {
      actorId,
      view: query.view,
      range: query.range,
      source: config.source,
      failed,
    })

    return ok(result)
  },
}
