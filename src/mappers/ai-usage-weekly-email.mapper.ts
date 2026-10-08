import {
  addUtcDays,
  startOfUtcWeek,
  type UtcRange,
  utcDayKey,
} from '@/src/lib/ai/usage-period'
import type {
  AiUsageDailyCost,
  AiUsageGroupRow,
} from '@/src/repositories/ai-usage-analytics.repository'
import type {
  AiUsageBreakdownItemDTO,
  AiUsageWeeklyAgentsDTO,
  AiUsageWeeklyItemDTO,
  AiUsageWeeklyReportDTO,
} from '@/types/ai-usage'
import {
  type AiUsageUserName,
  changePercent,
  overviewQueryRange,
  toAiUsageAnalyticsDTO,
  toAiUsageOverviewDTO,
} from './ai-usage-analytics.mapper'

/** How many rows each "top" list of the weekly e-mail shows. */
export const AI_USAGE_WEEKLY_TOP = {
  models: 3,
  features: 3,
  modules: 3,
  members: 5,
} as const

/**
 * The week the e-mail reports on: the ISO week (Monday 00:00 UTC) before the
 * one `now` falls in — the same UTC weeks as the "Uso" tab and the quota.
 */
export function aiUsageWeeklyReportWeek(now: Date): UtcRange {
  const to = startOfUtcWeek(now)
  return { from: addUtcDays(to, -7), to }
}

/** Ledger days the report reads, for a week starting at `weekStart`. */
export function aiUsageWeeklyDailyRange(weekStart: Date): UtcRange {
  return overviewQueryRange(aiUsageWeeklyAsOf(weekStart))
}

/**
 * Snapshot instant of the report: the last millisecond of the reported
 * week. The month block reads "up to the end of the week", so a retry on
 * Tuesday, or a week that closed the previous month, still shows a complete
 * and stable picture.
 */
function aiUsageWeeklyAsOf(weekStart: Date): Date {
  return new Date(addUtcDays(weekStart, 7).getTime() - 1)
}

function sumDays(daily: AiUsageDailyCost[], range: UtcRange): number {
  const from = utcDayKey(range.from)
  const to = utcDayKey(range.to)
  let total = 0
  for (const day of daily) {
    if (day.day >= from && day.day < to) total += day.workspaceUsd
  }
  return Math.round(total * 1_000_000) / 1_000_000
}

function top(
  items: AiUsageBreakdownItemDTO[],
  limit: number,
): AiUsageWeeklyItemDTO[] {
  return items
    .filter((item) => item.costUsd > 0)
    .slice(0, limit)
    .map(({ key, label, detail, costUsd, share }) => ({
      key,
      label,
      detail,
      costUsd,
      share,
    }))
}

/**
 * Numbers of the weekly Steel AI usage e-mail of one workspace. Reuses the
 * "Uso" (month progress and linear projection) and "Análises" (breakdowns)
 * mappers over the same ledger rows, so the e-mail never disagrees with the
 * pages. Money is the real cost frozen in `AiUsage.costUsd` (ADR 0019).
 */
export function toAiUsageWeeklyReport(input: {
  weekStart: Date
  /** Workspace cost per UTC day over `aiUsageWeeklyDailyRange(weekStart)`. */
  daily: AiUsageDailyCost[]
  /** Report week grouped by (provider, model, feature, module). */
  groups: AiUsageGroupRow[]
  /** Report week grouped by user. */
  userGroups: AiUsageGroupRow[]
  users: AiUsageUserName[]
  monthlyQuotaUsd: number
  agents: AiUsageWeeklyAgentsDTO
}): AiUsageWeeklyReportDTO {
  const week: UtcRange = {
    from: input.weekStart,
    to: addUtcDays(input.weekStart, 7),
  }
  const previous: UtcRange = {
    from: addUtcDays(input.weekStart, -7),
    to: input.weekStart,
  }
  const weekUsd = sumDays(input.daily, week)
  const previousWeekUsd = sumDays(input.daily, previous)

  const overview = toAiUsageOverviewDTO({
    daily: input.daily,
    monthlyQuotaUsd: input.monthlyQuotaUsd,
    canViewWorkspace: true,
    now: aiUsageWeeklyAsOf(input.weekStart),
  })
  const month = overview.month
  const quotaUsd = input.monthlyQuotaUsd

  const analytics = toAiUsageAnalyticsDTO({
    scope: 'workspace',
    period: 'custom',
    range: week,
    groups: input.groups,
    userGroups: input.userGroups,
    users: input.users,
    daily: [],
    canViewWorkspace: true,
  })

  const agents = input.agents
  const hasAgentActivity =
    agents.runs > 0 || agents.actions > 0 || agents.pendingApprovals > 0

  return {
    weekStart: week.from.toISOString(),
    weekEnd: week.to.toISOString(),
    weekUsd,
    previousWeekUsd,
    changePercent: changePercent(weekUsd, previousWeekUsd),
    month: {
      start: month.start,
      asOf: utcDayKey(addUtcDays(week.to, -1)),
      days: month.days,
      elapsedDays: month.elapsedDays,
      usedUsd: month.workspaceUsd,
      quotaUsd,
      usedShare: quotaUsd > 0 ? month.workspaceUsd / quotaUsd : null,
      projectedUsd: month.projectedWorkspaceUsd,
      projectionExceedsQuota:
        quotaUsd > 0 && month.projectedWorkspaceUsd > quotaUsd,
    },
    topModels: top(analytics.byModel, AI_USAGE_WEEKLY_TOP.models),
    topFeatures: top(analytics.byFeature, AI_USAGE_WEEKLY_TOP.features),
    topModules: top(analytics.byModule, AI_USAGE_WEEKLY_TOP.modules),
    // Members only: the "Automações" bucket (no user) is not a person.
    // `byUser` is never null here: the user groups were passed in.
    topMembers: top(
      (analytics.byUser as AiUsageBreakdownItemDTO[]).filter(
        (item) => item.key !== 'none',
      ),
      AI_USAGE_WEEKLY_TOP.members,
    ),
    agents: hasAgentActivity ? agents : null,
  }
}

/** `true` when neither the reported week nor the one before had any spend. */
export function isAiUsageWeeklyReportEmpty(
  report: Pick<AiUsageWeeklyReportDTO, 'weekUsd' | 'previousWeekUsd'>,
): boolean {
  return report.weekUsd <= 0 && report.previousWeekUsd <= 0
}

/** `YYYY-MM-DD` key of a report week (its Monday), used in job ids/markers. */
export function aiUsageWeekKey(weekStart: Date): string {
  return utcDayKey(weekStart)
}
