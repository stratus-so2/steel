import { describe, expect, it } from 'vitest'
import {
  bucketChurnByMonth,
  computeMrr,
  monthKey,
  monthlyEquivalentCents,
  recentMonths,
  summarizeUsage,
  type UsageRow,
} from '../metrics'

const NOW = new Date('2026-09-18T15:00:00Z')

describe('monthlyEquivalentCents()', () => {
  it('keeps monthly amounts and divides yearly ones by 12', () => {
    expect(monthlyEquivalentCents(4302, 'MONTHLY')).toBe(4302)
    expect(monthlyEquivalentCents(38715, 'YEARLY')).toBe(3226)
  })
})

describe('computeMrr()', () => {
  it('sums one subscription per paying workspace', () => {
    expect(
      computeMrr([
        { workspaceId: 'a', amount: 4302, interval: 'MONTHLY' },
        // older paid subscription of the same workspace — ignored
        { workspaceId: 'a', amount: 9999, interval: 'MONTHLY' },
        { workspaceId: 'b', amount: 83681, interval: 'YEARLY' },
      ]),
    ).toEqual({ cents: 4302 + 6973, payingWorkspaces: 2 })
  })

  it('is zero without paying workspaces', () => {
    expect(computeMrr([])).toEqual({ cents: 0, payingWorkspaces: 0 })
  })
})

describe('monthKey() / recentMonths()', () => {
  it('uses the São Paulo month', () => {
    expect(monthKey(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09')
  })

  it('lists months across a year boundary, oldest first', () => {
    expect(recentMonths(new Date('2026-02-10T12:00:00Z'), 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })
})

describe('bucketChurnByMonth()', () => {
  it('counts cancellations and expirations per month with lost MRR', () => {
    const churn = bucketChurnByMonth(
      [
        {
          status: 'CANCELLED',
          amount: 4302,
          interval: 'MONTHLY',
          endedAt: new Date('2026-09-02T12:00:00Z'),
        },
        {
          status: 'EXPIRED',
          amount: 38715,
          interval: 'YEARLY',
          endedAt: new Date('2026-09-10T12:00:00Z'),
        },
        {
          status: 'CANCELLED',
          amount: 8006,
          interval: 'MONTHLY',
          endedAt: new Date('2026-07-15T12:00:00Z'),
        },
        // outside the window
        {
          status: 'CANCELLED',
          amount: 1,
          interval: 'MONTHLY',
          endedAt: new Date('2025-01-15T12:00:00Z'),
        },
      ],
      NOW,
      3,
    )

    expect(churn).toEqual([
      { month: '2026-07', cancelled: 1, expired: 0, lostMrrCents: 8006 },
      { month: '2026-08', cancelled: 0, expired: 0, lostMrrCents: 0 },
      { month: '2026-09', cancelled: 1, expired: 1, lostMrrCents: 4302 + 3226 },
    ])
  })
})

describe('summarizeUsage()', () => {
  const row = (overrides: Partial<UsageRow>): UsageRow => ({
    day: '2026-09-17',
    workspaceId: 'ws1',
    workspaceName: 'Acme',
    workspaceSlug: 'acme',
    module: 'CRM',
    requests: 1,
    mutations: 0,
    ...overrides,
  })

  it('aggregates totals per module, daily series and top workspaces', () => {
    const summary = summarizeUsage([
      row({ requests: 10, mutations: 2 }),
      row({ day: '2026-09-18', requests: 5, mutations: 1 }),
      row({ module: 'COMMUNICATION', requests: 7 }),
      row({
        workspaceId: 'ws2',
        workspaceName: 'Beta',
        workspaceSlug: 'beta',
        requests: 30,
      }),
    ])

    expect(summary.totals).toEqual([
      { module: 'SERVICE_DESK', requests: 0, mutations: 0, workspaces: 0 },
      { module: 'CRM', requests: 45, mutations: 3, workspaces: 2 },
      { module: 'COMMUNICATION', requests: 7, mutations: 0, workspaces: 1 },
    ])
    expect(summary.daily).toEqual([
      { day: '2026-09-17', module: 'COMMUNICATION', requests: 7, mutations: 0 },
      { day: '2026-09-17', module: 'CRM', requests: 40, mutations: 2 },
      { day: '2026-09-18', module: 'CRM', requests: 5, mutations: 1 },
    ])
    expect(summary.topWorkspaces.map((w) => [w.slug, w.requests])).toEqual([
      ['beta', 30],
      ['acme', 22],
    ])
    expect(summary.activeWorkspaces).toBe(2)
  })

  it('limits the ranking', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row({ workspaceId: `ws${i}`, requests: i }),
    )
    expect(summarizeUsage(rows, 5).topWorkspaces).toHaveLength(5)
  })
})
