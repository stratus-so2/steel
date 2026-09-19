import type { AplRow } from '@/src/lib/analytics/axiom-query'
import { scrubMessage } from '@/src/lib/analytics/scrub'
import { bucketStarts, type TimeWindow } from '@/src/lib/analytics/time-range'
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

/*
 * Linhas APL (formato tabular do Axiom) → DTOs do painel Analytics. O Axiom
 * devolve `_time` do `bin()` como ISO, `max(_time)` como epoch em
 * nanossegundos, percentis como float (ou `null` sem dados) e strings vazias
 * para campos ausentes — tudo normalizado aqui.
 */

const count = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

const ms = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

/** ISO de um tempo do Axiom: string ISO, epoch ms, µs ou ns. */
export function toIso(value: unknown): string {
  if (typeof value === 'number') {
    let msValue = value
    if (value > 1e17) msValue = value / 1e6
    else if (value > 1e14) msValue = value / 1e3
    return new Date(msValue).toISOString()
  }
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString()
}

/** Preenche os baldes sem linha (o Axiom só devolve baldes com eventos). */
function fillBuckets<T>(
  rows: AplRow[],
  window: TimeWindow,
  map: (row: AplRow | undefined, t: string) => T,
): T[] {
  const byTime = new Map(
    rows.map((row) => [new Date(toIso(row._time)).getTime(), row]),
  )
  return bucketStarts(window).map((start) =>
    map(byTime.get(start.getTime()), start.toISOString()),
  )
}

export function toTrafficPoints(
  rows: AplRow[],
  window: TimeWindow,
): TrafficPoint[] {
  const minutes = window.binSeconds / 60
  return fillBuckets(rows, window, (row, t) => {
    const requests = count(row?.requests)
    return {
      t,
      requests,
      rpm: Math.round((requests / minutes) * 100) / 100,
      errors4xx: count(row?.errors4xx),
      errors5xx: count(row?.errors5xx),
      p50: ms(row?.p50),
      p95: ms(row?.p95),
      p99: ms(row?.p99),
    }
  })
}

export function toTrafficTotals(rows: AplRow[]): TrafficTotals {
  const row = rows[0] ?? {}
  return {
    requests: count(row.requests),
    errors4xx: count(row.errors4xx),
    errors5xx: count(row.errors5xx),
    p50: ms(row.p50),
    p95: ms(row.p95),
    p99: ms(row.p99),
    users: count(row.users),
    workspaces: count(row.workspaces),
  }
}

export function toRouteStats(rows: AplRow[]): RouteStat[] {
  return rows.map((row) => ({
    route: text(row.route) ?? '(sem rota)',
    method: text(row.method) ?? '—',
    requests: count(row.requests),
    errors4xx: count(row.errors4xx),
    errors5xx: count(row.errors5xx),
    p50: ms(row.p50),
    p95: ms(row.p95),
  }))
}

export function toStatusCounts(rows: AplRow[]): StatusCount[] {
  return rows
    .filter((row) => /^\d+$/.test(String(row.status ?? '')))
    .map((row) => ({ status: Number(row.status), count: count(row.count) }))
}

export function toErrorSamples(rows: AplRow[]): ErrorSample[] {
  return rows.map((row) => ({
    t: toIso(row._time),
    method: text(row.method) ?? '—',
    route: text(row.route) ?? '(sem rota)',
    status: count(row.status),
    code: text(row.errorCode),
    // Já vem limpa do log; limpa de novo para eventos antigos/de terceiros.
    message: scrubMessage(text(row.errorMessage)),
    durationMs: ms(row.duration),
  }))
}

export function toErrorGroups(rows: AplRow[]): ErrorGroup[] {
  return rows.map((row) => ({
    status: count(row.status),
    code: text(row.errorCode),
    route: text(row.route) ?? '(sem rota)',
    message: scrubMessage(text(row.errorMessage)),
    count: count(row.count),
    lastSeen: toIso(row.lastSeen),
  }))
}

export function toErrorTrend(
  rows: AplRow[],
  window: TimeWindow,
): ErrorTrendPoint[] {
  return fillBuckets(rows, window, (row, t) => ({
    t,
    errors4xx: count(row?.errors4xx),
    errors5xx: count(row?.errors5xx),
  }))
}

export function toActivity(
  rows: AplRow[],
  window: TimeWindow,
): ActivityPoint[] {
  return fillBuckets(rows, window, (row, t) => ({
    t,
    users: count(row?.users),
    workspaces: count(row?.workspaces),
  }))
}

export function toAccessTotals(
  unique: AplRow[],
  pageViews: AplRow[],
): AccessTotals {
  return {
    users: count(unique[0]?.users),
    workspaces: count(unique[0]?.workspaces),
    pageViews: count(pageViews[0]?.pageViews),
  }
}

export function toCountries(rows: AplRow[]): CountryCount[] {
  return rows
    .filter((row) => text(row.country))
    .map((row) => ({
      country: text(row.country) as string,
      countryCode: text(row.countryCode),
      count: count(row.count),
    }))
}

export function toCities(rows: AplRow[]): CityCount[] {
  return rows
    .filter((row) => text(row.city))
    .map((row) => ({
      city: text(row.city) as string,
      country: text(row.country) ?? '—',
      count: count(row.count),
    }))
}

const DEVICE_LABEL: Record<string, string> = {
  desktop: 'Desktop',
  mobile: 'Celular',
  tablet: 'Tablet',
  bot: 'Bot/Script',
  unknown: 'Desconhecido',
}

function sumBy(rows: AplRow[], key: string, label = (v: string) => v) {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const name = label(text(row[key]) ?? 'unknown')
    totals.set(name, (totals.get(name) ?? 0) + count(row.count))
  }
  return [...totals.entries()]
    .map(([name, value]): NamedCount => ({ name, count: value }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Uma consulta `by browser, os, device` → três rankings. */
export function toClientBreakdown(rows: AplRow[]): {
  browsers: NamedCount[]
  os: NamedCount[]
  devices: NamedCount[]
} {
  const unknown = (v: string) => (v === 'unknown' ? 'Desconhecido' : v)
  return {
    browsers: sumBy(rows, 'browser', unknown),
    os: sumBy(rows, 'os', unknown),
    devices: sumBy(rows, 'device', (v) => DEVICE_LABEL[v] ?? v),
  }
}
