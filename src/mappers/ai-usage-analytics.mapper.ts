import type { AiUsageFeature, ModuleKind } from '@prisma/client'
import {
  AI_USAGE_FEATURE_LABELS,
  AI_USAGE_MODULE_LABELS,
  AI_USAGE_NO_USER_LABEL,
  type AiUsageModuleKey,
  aiUsageModelLabel,
  aiUsageModuleKey,
} from '@/src/lib/ai/usage-labels'
import {
  addUtcDays,
  addUtcMonths,
  daysBetween,
  startOfUtcDay,
  startOfUtcMonth,
  startOfUtcWeek,
  type UtcRange,
  utcDayKey,
} from '@/src/lib/ai/usage-period'
import type {
  AiUsageDailyCost,
  AiUsageExportRow,
  AiUsageGroupRow,
} from '@/src/repositories/ai-usage-analytics.repository'
import type {
  AiUsageAnalyticsDTO,
  AiUsageBreakdownItemDTO,
  AiUsageCumulativePointDTO,
  AiUsageDailyPointDTO,
  AiUsageOverviewDTO,
  AiUsagePeriodPreset,
  AiUsagePeriodSummaryDTO,
  AiUsageScope,
  AiUsageTotalsDTO,
} from '@/types/ai-usage'

/** Money rounded to cents for display DTOs (the ledger keeps 6 decimals). */
function cents(value: number): number {
  return Math.round(value * 100) / 100
}

/** Keeps sub-cent precision for small personal amounts. */
function micros(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

/**
 * Days the overview reads: from the previous month's first day to today.
 * The previous ISO week always falls inside it (it starts at most 13 days
 * before today, and a month has at least 28).
 */
export function overviewQueryRange(now: Date): UtcRange {
  return {
    from: addUtcMonths(startOfUtcMonth(now), -1),
    to: addUtcDays(startOfUtcDay(now), 1),
  }
}

type DayIndex = Map<string, { mine: number; workspace: number }>

function cumulative(
  index: DayIndex,
  start: Date,
  days: number,
): AiUsageCumulativePointDTO[] {
  const points: AiUsageCumulativePointDTO[] = []
  let mine = 0
  let workspace = 0
  for (let i = 0; i < days; i++) {
    const date = utcDayKey(addUtcDays(start, i))
    const day = index.get(date)
    mine += day?.mine ?? 0
    workspace += day?.workspace ?? 0
    points.push({
      date,
      mineUsd: micros(mine),
      workspaceUsd: micros(workspace),
    })
  }
  return points
}

/** % change from `base` to `value`; `null` when there is no base. */
export function changePercent(value: number, base: number): number | null {
  if (base <= 0) return null
  return Math.round(((value - base) / base) * 1000) / 10
}

function periodSummary(input: {
  kind: 'week' | 'month'
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
  limitUsd: number
  index: DayIndex
  today: Date
}): AiUsagePeriodSummaryDTO {
  const days = daysBetween(input.start, input.end)
  const elapsedDays = Math.min(
    days,
    Math.max(1, daysBetween(input.start, input.today) + 1),
  )
  const points = cumulative(input.index, input.start, elapsedDays)
  const last = points[points.length - 1]
  const previousDays = daysBetween(input.previousStart, input.previousEnd)
  const previousPoints = cumulative(
    input.index,
    input.previousStart,
    previousDays,
  )
  const previousLast = previousPoints[previousPoints.length - 1]
  const samePoint = previousPoints[Math.min(elapsedDays, previousDays) - 1]
  const project = (value: number) => micros((value / elapsedDays) * days)

  return {
    kind: input.kind,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    days,
    elapsedDays,
    limitUsd: cents(input.limitUsd),
    points,
    mineUsd: last.mineUsd,
    workspaceUsd: last.workspaceUsd,
    projectedMineUsd: project(last.mineUsd),
    projectedWorkspaceUsd: project(last.workspaceUsd),
    previous: {
      start: input.previousStart.toISOString(),
      end: input.previousEnd.toISOString(),
      points: previousPoints,
      mineUsd: previousLast.mineUsd,
      workspaceUsd: previousLast.workspaceUsd,
      mineSamePointUsd: samePoint.mineUsd,
      workspaceSamePointUsd: samePoint.workspaceUsd,
    },
    mineChangePercent: changePercent(last.mineUsd, samePoint.mineUsd),
    workspaceChangePercent: changePercent(
      last.workspaceUsd,
      samePoint.workspaceUsd,
    ),
  }
}

/**
 * Personal "Uso" page: cumulative spend of the user and of the whole
 * workspace for the current month and ISO week (UTC), the previous ones and
 * a linear projection. There are no per-user caps: the available amount is
 * the workspace quota (month) or its weekly share, quota × 7 ÷ days in the
 * current month.
 */
export function toAiUsageOverviewDTO(input: {
  daily: AiUsageDailyCost[]
  monthlyQuotaUsd: number
  canViewWorkspace: boolean
  now: Date
}): AiUsageOverviewDTO {
  const index: DayIndex = new Map(
    input.daily.map((d) => [
      d.day,
      { mine: d.mineUsd, workspace: d.workspaceUsd },
    ]),
  )
  const today = startOfUtcDay(input.now)
  const monthStart = startOfUtcMonth(input.now)
  const monthEnd = addUtcMonths(monthStart, 1)
  const weekStart = startOfUtcWeek(input.now)
  const daysInMonth = daysBetween(monthStart, monthEnd)
  const weeklyShareUsd = (input.monthlyQuotaUsd * 7) / daysInMonth

  return {
    timezone: 'UTC',
    generatedAt: input.now.toISOString(),
    monthlyQuotaUsd: input.monthlyQuotaUsd,
    weeklyShareUsd: cents(weeklyShareUsd),
    month: periodSummary({
      kind: 'month',
      start: monthStart,
      end: monthEnd,
      previousStart: addUtcMonths(monthStart, -1),
      previousEnd: monthStart,
      limitUsd: input.monthlyQuotaUsd,
      index,
      today,
    }),
    week: periodSummary({
      kind: 'week',
      start: weekStart,
      end: addUtcDays(weekStart, 7),
      previousStart: addUtcDays(weekStart, -7),
      previousEnd: weekStart,
      limitUsd: weeklyShareUsd,
      index,
      today,
    }),
    canViewWorkspace: input.canViewWorkspace,
  }
}

function emptyTotals(): AiUsageTotalsDTO {
  return { costUsd: 0, inputTokens: 0, outputTokens: 0, calls: 0 }
}

function addTotals(target: AiUsageTotalsDTO, row: AiUsageGroupRow): void {
  target.costUsd += row.costUsd
  target.inputTokens += row.inputTokens
  target.outputTokens += row.outputTokens
  target.calls += row.calls
}

/** Folds grouped rows into labelled items, most expensive first. */
function fold(
  rows: AiUsageGroupRow[],
  total: number,
  describe: (row: AiUsageGroupRow) => {
    key: string
    label: string
    detail: string | null
  },
): AiUsageBreakdownItemDTO[] {
  const items = new Map<string, AiUsageBreakdownItemDTO>()
  for (const row of rows) {
    const { key, label, detail } = describe(row)
    const item = items.get(key) ?? {
      key,
      label,
      detail,
      share: 0,
      ...emptyTotals(),
    }
    addTotals(item, row)
    items.set(key, item)
  }
  return [...items.values()]
    .map((item) => ({
      ...item,
      costUsd: micros(item.costUsd),
      share: total > 0 ? item.costUsd / total : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd || a.label.localeCompare(b.label))
}

export interface AiUsageUserName {
  id: string
  name: string
  email: string
}

export function modelItem(row: Pick<AiUsageGroupRow, 'provider' | 'model'>) {
  return {
    key: `${row.provider}:${row.model}`,
    label: aiUsageModelLabel(row.provider ?? '', row.model ?? ''),
    detail: row.provider ?? null,
  }
}

export function featureItem(row: Pick<AiUsageGroupRow, 'feature'>) {
  const feature = row.feature as AiUsageFeature
  return {
    key: feature,
    label: AI_USAGE_FEATURE_LABELS[feature] ?? feature,
    detail: null,
  }
}

export function moduleItem(row: Pick<AiUsageGroupRow, 'feature' | 'module'>) {
  const key: AiUsageModuleKey = aiUsageModuleKey(
    row.feature as AiUsageFeature,
    (row.module ?? null) as ModuleKind | null,
  )
  return { key, label: AI_USAGE_MODULE_LABELS[key], detail: null }
}

export function userItem(
  row: Pick<AiUsageGroupRow, 'userId'>,
  users: Map<string, AiUsageUserName>,
) {
  if (!row.userId) {
    return { key: 'none', label: AI_USAGE_NO_USER_LABEL, detail: null }
  }
  const user = users.get(row.userId)
  return {
    key: row.userId,
    label: user?.name || user?.email || 'Usuário removido',
    detail: user?.email ?? null,
  }
}

function dailySeries(
  daily: AiUsageDailyCost[],
  range: UtcRange,
  scope: AiUsageScope,
): AiUsageDailyPointDTO[] {
  const byDay = new Map(
    daily.map((d) => [
      d.day,
      scope === 'personal' ? d.mineUsd : d.workspaceUsd,
    ]),
  )
  const days = daysBetween(range.from, range.to)
  return Array.from({ length: days }, (_, i) => {
    const date = utcDayKey(addUtcDays(range.from, i))
    return { date, costUsd: micros(byDay.get(date) ?? 0) }
  })
}

/**
 * "Análises" page. `byModel` / `byFeature` / `byModule` come from rows
 * grouped by (provider, model, feature, module); `byUser` from rows grouped
 * by user (workspace scope only). `daily` is the user's cost per day in the
 * personal scope and the workspace's in the workspace scope.
 */
export function toAiUsageAnalyticsDTO(input: {
  scope: AiUsageScope
  period: AiUsagePeriodPreset
  range: UtcRange
  groups: AiUsageGroupRow[]
  userGroups: AiUsageGroupRow[] | null
  users: AiUsageUserName[]
  daily: AiUsageDailyCost[]
  canViewWorkspace: boolean
}): AiUsageAnalyticsDTO {
  const totals = emptyTotals()
  for (const row of input.groups) addTotals(totals, row)
  const users = new Map(input.users.map((u) => [u.id, u]))

  return {
    scope: input.scope,
    period: input.period,
    timezone: 'UTC',
    from: input.range.from.toISOString(),
    to: input.range.to.toISOString(),
    totals: { ...totals, costUsd: micros(totals.costUsd) },
    daily: dailySeries(input.daily, input.range, input.scope),
    byModel: fold(input.groups, totals.costUsd, modelItem),
    byFeature: fold(input.groups, totals.costUsd, featureItem),
    byModule: fold(input.groups, totals.costUsd, moduleItem),
    byUser: input.userGroups
      ? fold(input.userGroups, totals.costUsd, (row) => userItem(row, users))
      : null,
    canViewWorkspace: input.canViewWorkspace,
  }
}

/* ------------------------------------------------------------------ */
/* CSV                                                                  */
/* ------------------------------------------------------------------ */

/**
 * RFC 4180 field, plus a guard against spreadsheet formula injection: a
 * text cell starting with `=`, `+`, `-`, `@`, tab or CR gets a leading `'`.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value)
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function csvLine(cells: (string | number | null)[]): string {
  return `${cells.map(csvCell).join(',')}\r\n`
}

export const AI_USAGE_ROWS_CSV_HEADER = [
  'data_utc',
  'usuario',
  'email',
  'recurso',
  'codigo_recurso',
  'provedor',
  'modelo',
  'escopo',
  'tokens_entrada',
  'tokens_saida',
  'custo_usd',
]

export function toAiUsageCsvRow(row: AiUsageExportRow): string {
  const feature = row.feature as AiUsageFeature
  return csvLine([
    row.createdAt.toISOString(),
    row.userName ?? (row.userId ? 'Usuário removido' : AI_USAGE_NO_USER_LABEL),
    row.userEmail,
    AI_USAGE_FEATURE_LABELS[feature] ?? feature,
    feature,
    row.provider,
    aiUsageModelLabel(row.provider, row.model),
    AI_USAGE_MODULE_LABELS[
      aiUsageModuleKey(feature, (row.module ?? null) as ModuleKind | null)
    ],
    row.inputTokens,
    row.outputTokens,
    row.costUsd,
  ])
}

export const AI_USAGE_AGGREGATE_CSV_HEADER = [
  'chave',
  'nome',
  'detalhe',
  'chamadas',
  'tokens_entrada',
  'tokens_saida',
  'custo_usd',
  'participacao_percentual',
]

export function toAiUsageAggregateCsvRow(
  item: AiUsageBreakdownItemDTO,
): string {
  return csvLine([
    item.key,
    item.label,
    item.detail,
    item.calls,
    item.inputTokens,
    item.outputTokens,
    item.costUsd,
    Math.round(item.share * 10000) / 100,
  ])
}
