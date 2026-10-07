/**
 * Steel AI usage pages (Uso / Análises). Money is US$ (`AiUsage.costUsd`,
 * real cost — ADR 0019); every day, week and month is in UTC, like the
 * monthly quota.
 */

export type AiUsageScope = 'personal' | 'workspace'

export type AiUsagePeriodPreset =
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom'

/** Cumulative spend up to and including `date` (UTC day). */
export interface AiUsageCumulativePointDTO {
  /** `YYYY-MM-DD` (UTC). */
  date: string
  mineUsd: number
  workspaceUsd: number
}

export interface AiUsagePeriodSummaryDTO {
  kind: 'week' | 'month'
  /** First day, 00:00 UTC (ISO). */
  start: string
  /** Day after the last one, 00:00 UTC (ISO, exclusive). */
  end: string
  /** Length of the period in days (7, or 28–31). */
  days: number
  /** Days elapsed including today (1..days). */
  elapsedDays: number
  /**
   * Available amount: the workspace monthly quota (month) or its weekly
   * share — quota × 7 ÷ days in the current month (week).
   */
  limitUsd: number
  /** Today and the days before it, cumulative. */
  points: AiUsageCumulativePointDTO[]
  mineUsd: number
  workspaceUsd: number
  /** Linear projection to the end of the period (daily average × days). */
  projectedMineUsd: number
  projectedWorkspaceUsd: number
  previous: {
    start: string
    end: string
    /** Every day of the previous period, cumulative. */
    points: AiUsageCumulativePointDTO[]
    mineUsd: number
    workspaceUsd: number
    /** Spend of the previous period up to the same day index as today. */
    mineSamePointUsd: number
    workspaceSamePointUsd: number
  }
  /** % change vs the previous period at the same point; `null` = no base. */
  mineChangePercent: number | null
  workspaceChangePercent: number | null
}

export interface AiUsageOverviewDTO {
  timezone: 'UTC'
  generatedAt: string
  monthlyQuotaUsd: number
  /** Monthly quota prorated to 7 days (quota × 7 ÷ days in the month). */
  weeklyShareUsd: number
  month: AiUsagePeriodSummaryDTO
  week: AiUsagePeriodSummaryDTO
  /** OWNER/ADMIN: may open the workspace view of Análises. */
  canViewWorkspace: boolean
}

export interface AiUsageTotalsDTO {
  costUsd: number
  inputTokens: number
  outputTokens: number
  calls: number
}

export interface AiUsageBreakdownItemDTO extends AiUsageTotalsDTO {
  key: string
  label: string
  /** Secondary text (user e-mail, provider). */
  detail: string | null
  /** Share of the period cost, 0..1. */
  share: number
}

export interface AiUsageDailyPointDTO {
  date: string
  costUsd: number
}

export interface AiUsageAnalyticsDTO {
  scope: AiUsageScope
  period: AiUsagePeriodPreset
  timezone: 'UTC'
  /** First day (ISO, 00:00 UTC). */
  from: string
  /** Exclusive end (ISO, 00:00 UTC of the day after the last one). */
  to: string
  totals: AiUsageTotalsDTO
  daily: AiUsageDailyPointDTO[]
  byModel: AiUsageBreakdownItemDTO[]
  byFeature: AiUsageBreakdownItemDTO[]
  byModule: AiUsageBreakdownItemDTO[]
  /** Workspace scope only (`null` in the personal view). */
  byUser: AiUsageBreakdownItemDTO[] | null
  canViewWorkspace: boolean
}
