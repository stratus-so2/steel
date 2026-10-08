import { describe, expect, it } from 'vitest'
import type {
  AiUsageDailyCost,
  AiUsageGroupRow,
} from '@/src/repositories/ai-usage-analytics.repository'
import {
  AI_USAGE_WEEKLY_TOP,
  aiUsageWeekKey,
  aiUsageWeeklyDailyRange,
  aiUsageWeeklyReportWeek,
  isAiUsageWeeklyReportEmpty,
  toAiUsageWeeklyReport,
} from '../ai-usage-weekly-email.mapper'

/** Monday of the reported week (Sep 28 – Oct 4, 2026). */
const WEEK_START = new Date('2026-09-28T00:00:00.000Z')

function day(date: string, workspaceUsd: number): AiUsageDailyCost {
  return { day: date, mineUsd: 0, workspaceUsd }
}

function group(overrides: Partial<AiUsageGroupRow>): AiUsageGroupRow {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    feature: 'STEEL_ASSISTANT',
    module: null,
    costUsd: 1,
    inputTokens: 100,
    outputTokens: 50,
    calls: 1,
    ...overrides,
  }
}

const DAILY = [
  day('2026-09-22', 8), // previous week
  day('2026-09-29', 5), // reported week (September)
  day('2026-10-02', 3), // reported week (October)
  day('2026-10-04', 2), // reported week (October, Sunday)
  day('2026-10-05', 99), // after the week: ignored
]

const NO_AGENTS = { runs: 0, actions: 0, pendingApprovals: 0 }

function build(
  overrides: Partial<Parameters<typeof toAiUsageWeeklyReport>[0]> = {},
) {
  return toAiUsageWeeklyReport({
    weekStart: WEEK_START,
    daily: DAILY,
    groups: [
      group({ costUsd: 6 }),
      group({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        feature: 'STEEL_AGENT',
        module: 'CRM',
        costUsd: 4,
      }),
    ],
    userGroups: [
      group({ userId: 'u1', costUsd: 5 }),
      group({ userId: null, costUsd: 3 }),
      group({ userId: 'u2', costUsd: 2 }),
    ],
    users: [
      { id: 'u1', name: 'Ana', email: 'ana@example.com' },
      { id: 'u2', name: 'Bruno', email: 'bruno@example.com' },
    ],
    monthlyQuotaUsd: 50,
    agents: NO_AGENTS,
    ...overrides,
  })
}

describe('aiUsageWeeklyReportWeek()', () => {
  it('reports the ISO week (UTC) before the one now falls in', () => {
    // Monday 08:00 in São Paulo = 11:00 UTC.
    const week = aiUsageWeeklyReportWeek(new Date('2026-10-05T11:00:00.000Z'))
    expect(week.from.toISOString()).toBe('2026-09-28T00:00:00.000Z')
    expect(week.to.toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(aiUsageWeekKey(week.from)).toBe('2026-09-28')
  })

  it('reads the ledger from the first day of the previous month', () => {
    const range = aiUsageWeeklyDailyRange(WEEK_START)
    expect(range.from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })
})

describe('toAiUsageWeeklyReport()', () => {
  it('sums the week and compares it with the previous one', () => {
    const report = build()
    expect(report.weekStart).toBe('2026-09-28T00:00:00.000Z')
    expect(report.weekEnd).toBe('2026-10-05T00:00:00.000Z')
    expect(report.weekUsd).toBe(10)
    expect(report.previousWeekUsd).toBe(8)
    expect(report.changePercent).toBe(25)
  })

  it('shows the month of the week end up to its Sunday, with a projection', () => {
    const { month } = build()
    expect(month).toEqual({
      start: '2026-10-01T00:00:00.000Z',
      asOf: '2026-10-04',
      days: 31,
      elapsedDays: 4,
      usedUsd: 5,
      quotaUsd: 50,
      usedShare: 0.1,
      projectedUsd: 38.75,
      projectionExceedsQuota: false,
    })
  })

  it('flags a projection above the quota', () => {
    const { month } = build({ monthlyQuotaUsd: 30 })
    expect(month.projectionExceedsQuota).toBe(true)
    expect(month.usedShare).toBeCloseTo(5 / 30)
  })

  it('has no share nor warning without a quota', () => {
    const { month } = build({ monthlyQuotaUsd: 0 })
    expect(month.usedShare).toBeNull()
    expect(month.projectionExceedsQuota).toBe(false)
  })

  it('ranks models, features, modules and members (automations left out)', () => {
    const report = build()
    expect(report.topModels.map((item) => item.label)).toEqual([
      'GPT-4o mini',
      'Claude Sonnet 5',
    ])
    expect(report.topModels[0]).toMatchObject({ costUsd: 6, share: 0.6 })
    expect(report.topFeatures.map((item) => item.key)).toEqual([
      'STEEL_ASSISTANT',
      'STEEL_AGENT',
    ])
    expect(report.topModules.map((item) => item.label)).toEqual([
      'Plataforma',
      'CRM',
    ])
    expect(report.topMembers).toEqual([
      {
        key: 'u1',
        label: 'Ana',
        detail: 'ana@example.com',
        costUsd: 5,
        share: 0.5,
      },
      {
        key: 'u2',
        label: 'Bruno',
        detail: 'bruno@example.com',
        costUsd: 2,
        share: 0.2,
      },
    ])
  })

  it('caps every list and drops zero-cost rows', () => {
    const models = Array.from({ length: 6 }, (_, i) =>
      group({ model: `m-${i}`, costUsd: i }),
    )
    const users = Array.from({ length: 8 }, (_, i) =>
      group({ userId: `u${i}`, costUsd: i + 1 }),
    )
    const report = build({ groups: models, userGroups: users, users: [] })
    expect(report.topModels).toHaveLength(AI_USAGE_WEEKLY_TOP.models)
    expect(report.topModels.map((item) => item.costUsd)).toEqual([5, 4, 3])
    expect(report.topMembers).toHaveLength(AI_USAGE_WEEKLY_TOP.members)
    expect(report.topMembers[0].label).toBe('Usuário removido')

    const zero = build({ groups: [group({ costUsd: 0 })], userGroups: [] })
    expect(zero.topModels).toEqual([])
    expect(zero.topMembers).toEqual([])
  })

  it('has no comparison base when the previous week was zero', () => {
    const report = build({ daily: [day('2026-09-30', 4)] })
    expect(report.previousWeekUsd).toBe(0)
    expect(report.changePercent).toBeNull()
  })

  it('keeps the agents block only when there was activity', () => {
    expect(build().agents).toBeNull()
    expect(
      build({ agents: { runs: 0, actions: 0, pendingApprovals: 2 } }).agents,
    ).toEqual({ runs: 0, actions: 0, pendingApprovals: 2 })
    expect(
      build({ agents: { runs: 3, actions: 1, pendingApprovals: 0 } }).agents,
    ).toEqual({ runs: 3, actions: 1, pendingApprovals: 0 })
  })
})

describe('isAiUsageWeeklyReportEmpty()', () => {
  it('is empty only when both weeks had no spend', () => {
    expect(isAiUsageWeeklyReportEmpty({ weekUsd: 0, previousWeekUsd: 0 })).toBe(
      true,
    )
    expect(isAiUsageWeeklyReportEmpty({ weekUsd: 0, previousWeekUsd: 1 })).toBe(
      false,
    )
    expect(isAiUsageWeeklyReportEmpty({ weekUsd: 1, previousWeekUsd: 0 })).toBe(
      false,
    )
  })
})
