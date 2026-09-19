import type {
  AnalyticsEnvironment,
  AnalyticsStatusClass,
} from '@/src/schemas/admin-analytics.schema'

/**
 * Todas as consultas APL (Axiom Processing Language) do painel Analytics,
 * num lugar só. Campos reais do dataset (conferidos em 19/09/2026):
 *
 * - `source`: `lambda` (log de resposta do `withAxiom`, uma linha por
 *   requisição de API) · `middleware` (proxy.ts, toda navegação/requisição)
 *   · `server-log` (logs da aplicação — fora daqui);
 * - `request.path`, `request.method`, `request.statusCode`,
 *   `request.startTime`/`endTime` (epoch ms) — existem desde sempre;
 * - `request.route`, `request.userId`, `request.workspaceId`,
 *   `request.workspaceSlug`, `request.errorCode`, `request.errorMessage`,
 *   `request.country`/`countryCode`/`city`, `request.browser`/`os`/`device`
 *   — gravados a partir de lib/axiom/request-log.ts. Eventos antigos não os
 *   têm: por isso `column_ifexists` (campo inexistente no dataset é erro de
 *   compilação no Axiom) e a normalização da rota por regex como reserva;
 * - `platform.environment` — `NODE_ENV` de quem gravou (o e2e do CI roda
 *   `next start`, então aparece como `production`).
 *
 * O intervalo de tempo vai no corpo da consulta (`startTime`/`endTime`), não
 * no APL. Valores do usuário entram só como literais de string escapados.
 */

export interface AplFilters {
  env?: AnalyticsEnvironment
  workspace?: string
  /** Slug do workspace filtrado — filtra os page views (proxy). */
  workspaceSlug?: string
  route?: string
  status?: AnalyticsStatusClass
}

/** Literal de string APL (aspas duplas, com `\` e `"` escapados). */
export function aplString(value: string): string {
  return JSON.stringify(value)
}

export function datasetRef(dataset: string): string {
  return `['${dataset.replace(/[^\w.-]/g, '')}']`
}

const optional = (field: string) => `tostring(column_ifexists('${field}', ''))`

/** Segmentos que são id (número, cuid, uuid/hash) — espelha route.ts. */
const ID_SEGMENT = `@'/([0-9]+|[a-z][a-z0-9]{19,31}|[0-9a-fA-F-]{32,36})(/|$)'`
const normalizePath = (expr: string) =>
  `replace_regex(${ID_SEGMENT}, @'/[id]\${2}', replace_regex(${ID_SEGMENT}, @'/[id]\${2}', ${expr}))`

const STATUS_RANGE: Record<AnalyticsStatusClass, [number, number]> = {
  '2xx': [200, 300],
  '3xx': [300, 400],
  '4xx': [400, 500],
  '5xx': [500, 600],
}

function envFilter(filters: AplFilters): string[] {
  return filters.env
    ? [`| where ['platform.environment'] == ${aplString(filters.env)}`]
    : []
}

/** Requisições de API (uma linha por resposta), com colunas derivadas. */
export function apiRequests(dataset: string, filters: AplFilters): string {
  const lines = [
    datasetRef(dataset),
    `| where source == "lambda" and isnotnull(['request.statusCode'])`,
    ...envFilter(filters),
    `| extend path = tostring(['request.path']), method = tostring(['request.method']), status = toint(['request.statusCode']), duration = todouble(['request.endTime']) - todouble(['request.startTime'])`,
    `| extend r0 = ${optional('request.route')}, userId = ${optional('request.userId')}, w0 = ${optional('request.workspaceId')}, errorCode = ${optional('request.errorCode')}, errorMessage = ${optional('request.errorMessage')}`,
    `| extend route = iff(isnotempty(r0), r0, ${normalizePath('path')}), workspaceId = iff(isnotempty(w0), w0, extract(@'^/api/workspaces/([a-z0-9]{20,32})(/|$)', 1, path))`,
  ]
  if (filters.workspace) {
    lines.push(`| where workspaceId == ${aplString(filters.workspace)}`)
  }
  if (filters.route) lines.push(`| where route == ${aplString(filters.route)}`)
  if (filters.status) {
    const [min, max] = STATUS_RANGE[filters.status]
    lines.push(`| where status >= ${min} and status < ${max}`)
  }
  return lines.join('\n')
}

/** Page views vistos pelo proxy (sem API, assets ou `_next`). */
export function pageViews(dataset: string, filters: AplFilters): string {
  const lines = [
    datasetRef(dataset),
    `| where source == "middleware"`,
    ...envFilter(filters),
    `| extend path = tostring(['request.path'])`,
    `| where not(path startswith "/api/") and not(path startswith "/_next")`,
    `| extend r0 = ${optional('request.route')}, workspaceSlug = ${optional('request.workspaceSlug')}, country = ${optional('request.country')}, countryCode = ${optional('request.countryCode')}, city = ${optional('request.city')}, browser = ${optional('request.browser')}, os = ${optional('request.os')}, device = ${optional('request.device')}`,
    `| extend route = iff(isnotempty(r0), r0, ${normalizePath('path')})`,
  ]
  if (filters.workspace) {
    // Sem slug conhecido, nenhum page view casa (não mistura workspaces).
    lines.push(
      `| where workspaceSlug == ${aplString(filters.workspaceSlug ?? '')}`,
    )
  }
  if (filters.route) lines.push(`| where route == ${aplString(filters.route)}`)
  return lines.join('\n')
}

const TRAFFIC_AGGREGATES = [
  'requests = count()',
  'errors4xx = countif(status >= 400 and status < 500)',
  'errors5xx = countif(status >= 500)',
  'p50 = percentile(duration, 50)',
  'p95 = percentile(duration, 95)',
  'p99 = percentile(duration, 99)',
].join(', ')

const UNIQUE_AGGREGATES =
  'users = dcountif(userId, isnotempty(userId)), workspaces = dcountif(workspaceId, isnotempty(workspaceId))'

export const APL = {
  trafficSeries: (dataset: string, filters: AplFilters, bin: string) =>
    `${apiRequests(dataset, filters)}\n| summarize ${TRAFFIC_AGGREGATES} by bin(_time, ${bin})\n| order by _time asc`,

  trafficTotals: (dataset: string, filters: AplFilters) =>
    `${apiRequests(dataset, filters)}\n| summarize ${TRAFFIC_AGGREGATES}, ${UNIQUE_AGGREGATES}`,

  routeStats: (dataset: string, filters: AplFilters, limit = 200) =>
    `${apiRequests(dataset, filters)}\n| summarize requests = count(), errors4xx = countif(status >= 400 and status < 500), errors5xx = countif(status >= 500), p50 = percentile(duration, 50), p95 = percentile(duration, 95) by route, method\n| order by requests desc\n| take ${limit}`,

  statusBreakdown: (dataset: string, filters: AplFilters) =>
    `${apiRequests(dataset, filters)}\n| summarize count = count() by status\n| order by count desc`,

  errorSamples: (dataset: string, filters: AplFilters, limit = 30) =>
    `${apiRequests(dataset, filters)}\n| where status >= 400\n| project _time, method, route, status, errorCode, errorMessage, duration\n| order by _time desc\n| take ${limit}`,

  errorGroups: (dataset: string, filters: AplFilters, limit = 50) =>
    `${apiRequests(dataset, filters)}\n| where status >= 400\n| summarize count = count(), lastSeen = max(_time) by status, errorCode, route, errorMessage\n| order by count desc\n| take ${limit}`,

  errorTrend: (dataset: string, filters: AplFilters, bin: string) =>
    `${apiRequests(dataset, filters)}\n| where status >= 400\n| summarize errors4xx = countif(status < 500), errors5xx = countif(status >= 500) by bin(_time, ${bin})\n| order by _time asc`,

  activity: (dataset: string, filters: AplFilters, bin: string) =>
    `${apiRequests(dataset, filters)}\n| summarize ${UNIQUE_AGGREGATES} by bin(_time, ${bin})\n| order by _time asc`,

  uniqueTotals: (dataset: string, filters: AplFilters) =>
    `${apiRequests(dataset, filters)}\n| summarize ${UNIQUE_AGGREGATES}`,

  pageViewTotal: (dataset: string, filters: AplFilters) =>
    `${pageViews(dataset, filters)}\n| summarize pageViews = count()`,

  countries: (dataset: string, filters: AplFilters, limit = 20) =>
    `${pageViews(dataset, filters)}\n| where isnotempty(country)\n| summarize count = count() by country, countryCode\n| order by count desc\n| take ${limit}`,

  cities: (dataset: string, filters: AplFilters, limit = 20) =>
    `${pageViews(dataset, filters)}\n| where isnotempty(city)\n| summarize count = count() by city, country\n| order by count desc\n| take ${limit}`,

  clients: (dataset: string, filters: AplFilters) =>
    `${pageViews(dataset, filters)}\n| where isnotempty(browser)\n| summarize count = count() by browser, os, device`,
}

export type AplQueryName = keyof typeof APL
