import { describe, expect, it } from 'vitest'
import type {
  AiUsageExportRow,
  AiUsageGroupRow,
} from '@/src/repositories/ai-usage-analytics.repository'
import {
  AI_USAGE_AGGREGATE_CSV_HEADER,
  AI_USAGE_ROWS_CSV_HEADER,
  changePercent,
  csvCell,
  csvLine,
  featureItem,
  modelItem,
  overviewQueryRange,
  toAiUsageAggregateCsvRow,
  toAiUsageAnalyticsDTO,
  toAiUsageCsvRow,
  toAiUsageOverviewDTO,
  userItem,
} from '../ai-usage-analytics.mapper'

// Wednesday, 2026-10-07 (week Mon 05/10 – Sun 11/10; October has 31 days).
const NOW = new Date('2026-10-07T13:00:00.000Z')

function group(overrides: Partial<AiUsageGroupRow>): AiUsageGroupRow {
  return {
    costUsd: 1,
    inputTokens: 100,
    outputTokens: 10,
    calls: 1,
    ...overrides,
  }
}

describe('overviewQueryRange()', () => {
  it('reads from the previous month start to the end of today', () => {
    const range = overviewQueryRange(NOW)
    expect(range.from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-10-08T00:00:00.000Z')
  })
})

describe('changePercent()', () => {
  it('returns the rounded % change, or null without a base', () => {
    expect(changePercent(15, 10)).toBe(50)
    expect(changePercent(1, 3)).toBe(-66.7)
    expect(changePercent(5, 0)).toBeNull()
  })
})

describe('toAiUsageOverviewDTO()', () => {
  const daily = [
    { day: '2026-09-02', mineUsd: 1, workspaceUsd: 4 },
    { day: '2026-09-30', mineUsd: 2, workspaceUsd: 10 },
    { day: '2026-10-01', mineUsd: 0.5, workspaceUsd: 2 },
    { day: '2026-09-29', mineUsd: 0.25, workspaceUsd: 1 },
    { day: '2026-10-06', mineUsd: 1, workspaceUsd: 3 },
  ]
  const dto = toAiUsageOverviewDTO({
    daily,
    monthlyQuotaUsd: 62,
    canViewWorkspace: true,
    now: NOW,
  })

  it('reports the quota, the weekly share and the UTC clock', () => {
    expect(dto.timezone).toBe('UTC')
    expect(dto.monthlyQuotaUsd).toBe(62)
    // 62 × 7 ÷ 31
    expect(dto.weeklyShareUsd).toBe(14)
    expect(dto.canViewWorkspace).toBe(true)
  })

  it('builds the month: cumulative points up to today, projection and comparison', () => {
    const { month } = dto
    expect(month.kind).toBe('month')
    expect(month.days).toBe(31)
    expect(month.elapsedDays).toBe(7)
    expect(month.limitUsd).toBe(62)
    expect(month.points).toHaveLength(7)
    expect(month.points[0]).toEqual({
      date: '2026-10-01',
      mineUsd: 0.5,
      workspaceUsd: 2,
    })
    expect(month.mineUsd).toBe(1.5)
    expect(month.workspaceUsd).toBe(5)
    // 1.5 / 7 × 31
    expect(month.projectedMineUsd).toBeCloseTo(6.642857, 6)
    expect(month.previous.points).toHaveLength(30)
    expect(month.previous.mineUsd).toBe(3.25)
    // September up to day 7: only the 2nd.
    expect(month.previous.mineSamePointUsd).toBe(1)
    expect(month.previous.workspaceSamePointUsd).toBe(4)
    expect(month.mineChangePercent).toBe(50)
    expect(month.workspaceChangePercent).toBe(25)
  })

  it('builds the ISO week against the previous week', () => {
    const { week } = dto
    expect(week.start).toBe('2026-10-05T00:00:00.000Z')
    expect(week.end).toBe('2026-10-12T00:00:00.000Z')
    expect(week.days).toBe(7)
    expect(week.elapsedDays).toBe(3)
    expect(week.limitUsd).toBe(14)
    expect(week.mineUsd).toBe(1)
    expect(week.previous.start).toBe('2026-09-28T00:00:00.000Z')
    expect(week.previous.mineUsd).toBe(2.75)
    // Previous week up to Wednesday: 29/09 + 30/09.
    expect(week.previous.mineSamePointUsd).toBe(2.25)
    expect(week.mineChangePercent).toBe(-55.6)
  })

  it('has no comparison base and a zero projection without usage', () => {
    const empty = toAiUsageOverviewDTO({
      daily: [],
      monthlyQuotaUsd: 50,
      canViewWorkspace: false,
      now: new Date('2026-03-01T00:30:00.000Z'),
    })
    expect(empty.month.elapsedDays).toBe(1)
    expect(empty.month.previous.points).toHaveLength(28)
    expect(empty.month.mineChangePercent).toBeNull()
    expect(empty.month.projectedWorkspaceUsd).toBe(0)
    expect(empty.weeklyShareUsd).toBe(11.29)
  })
})

describe('breakdown items', () => {
  it('labels models from the catalog, keeping unknown ids', () => {
    expect(modelItem({ provider: 'openai', model: 'gpt-4o-mini' })).toEqual({
      key: 'openai:gpt-4o-mini',
      label: 'GPT-4o mini',
      detail: 'openai',
    })
    expect(modelItem({}).detail).toBeNull()
  })

  it('falls back to the raw feature code for an unknown feature', () => {
    expect(featureItem({ feature: 'STEEL_AGENT' }).label).toBe('Steel Agents')
    expect(featureItem({ feature: 'NEW_THING' as never }).label).toBe(
      'NEW_THING',
    )
  })

  it('labels users by name, then e-mail, removed or background', () => {
    const users = new Map([
      ['u1', { id: 'u1', name: 'Ana', email: 'ana@x.com' }],
      ['u2', { id: 'u2', name: '', email: 'bob@x.com' }],
    ])
    expect(userItem({ userId: 'u1' }, users)).toEqual({
      key: 'u1',
      label: 'Ana',
      detail: 'ana@x.com',
    })
    expect(userItem({ userId: 'u2' }, users).label).toBe('bob@x.com')
    expect(userItem({ userId: 'gone' }, users)).toEqual({
      key: 'gone',
      label: 'Usuário removido',
      detail: null,
    })
    expect(userItem({ userId: null }, users).key).toBe('none')
  })
})

describe('toAiUsageAnalyticsDTO()', () => {
  const range = {
    from: new Date('2026-10-01T00:00:00.000Z'),
    to: new Date('2026-10-04T00:00:00.000Z'),
  }
  const groups = [
    group({
      provider: 'openai',
      model: 'gpt-4o-mini',
      feature: 'WHATSAPP_REPLY',
      module: null,
      costUsd: 1,
    }),
    group({
      provider: 'openai',
      model: 'gpt-4o-mini',
      feature: 'STEEL_ASSISTANT',
      module: 'CRM',
      costUsd: 2,
    }),
    group({
      provider: 'anthropic',
      model: 'claude-opus-5',
      feature: 'STEEL_ASSISTANT',
      module: null,
      costUsd: 3,
    }),
  ]

  it('folds the groups into breakdowns sorted by cost, with shares and totals', () => {
    const dto = toAiUsageAnalyticsDTO({
      scope: 'workspace',
      period: 'this_month',
      range,
      groups,
      userGroups: [
        group({ userId: 'u1', costUsd: 5 }),
        group({ userId: null, costUsd: 1 }),
      ],
      users: [{ id: 'u1', name: 'Ana', email: 'ana@x.com' }],
      daily: [{ day: '2026-10-02', mineUsd: 1, workspaceUsd: 6 }],
      canViewWorkspace: true,
    })

    expect(dto.totals).toEqual({
      costUsd: 6,
      inputTokens: 300,
      outputTokens: 30,
      calls: 3,
    })
    expect(dto.from).toBe('2026-10-01T00:00:00.000Z')
    expect(dto.byModel.map((i) => [i.label, i.costUsd, i.calls])).toEqual([
      // Same cost: alphabetical.
      ['Claude Opus 5', 3, 1],
      ['GPT-4o mini', 3, 2],
    ])
    expect(dto.byModel[0].share).toBe(0.5)
    expect(dto.byFeature.map((i) => i.key)).toEqual([
      'STEEL_ASSISTANT',
      'WHATSAPP_REPLY',
    ])
    expect(dto.byModule.map((i) => [i.key, i.costUsd])).toEqual([
      ['PLATFORM', 3],
      ['CRM', 2],
      ['COMMUNICATION', 1],
    ])
    expect(dto.byUser?.map((i) => i.label)).toEqual([
      'Ana',
      'Automações (sem usuário)',
    ])
    // Workspace scope plots the workspace cost; missing days are zero.
    expect(dto.daily).toEqual([
      { date: '2026-10-01', costUsd: 0 },
      { date: '2026-10-02', costUsd: 6 },
      { date: '2026-10-03', costUsd: 0 },
    ])
  })

  it('plots the user cost and has no user breakdown in the personal scope', () => {
    const dto = toAiUsageAnalyticsDTO({
      scope: 'personal',
      period: 'custom',
      range,
      groups: [],
      userGroups: null,
      users: [],
      daily: [{ day: '2026-10-02', mineUsd: 1, workspaceUsd: 6 }],
      canViewWorkspace: false,
    })
    expect(dto.byUser).toBeNull()
    expect(dto.byModel).toEqual([])
    expect(dto.daily[1].costUsd).toBe(1)
    expect(dto.totals.costUsd).toBe(0)
  })

  it('gives zero shares when the period cost is zero', () => {
    const dto = toAiUsageAnalyticsDTO({
      scope: 'personal',
      period: 'this_month',
      range,
      groups: [
        group({
          provider: 'openai',
          model: 'gpt-5',
          feature: 'STEEL_AGENT',
          module: null,
          costUsd: 0,
        }),
      ],
      userGroups: null,
      users: [],
      daily: [],
      canViewWorkspace: false,
    })
    expect(dto.byModel[0].share).toBe(0)
  })
})

describe('CSV', () => {
  it('escapes cells and neutralizes spreadsheet formulas', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(1.5)).toBe('1.5')
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('-1')).toBe("'-1")
    expect(csvLine(['a', 1, null])).toBe('a,1,\r\n')
  })

  it('writes a ledger row with pt-BR labels', () => {
    const row: AiUsageExportRow = {
      id: 'r1',
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
      userId: 'u1',
      userName: 'Ana',
      userEmail: 'ana@x.com',
      feature: 'WHATSAPP_REPLY',
      provider: 'openai',
      model: 'gpt-4o-mini',
      module: null,
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.000004,
    }
    expect(toAiUsageCsvRow(row)).toBe(
      '2026-10-02T10:00:00.000Z,Ana,ana@x.com,Resposta automática do WhatsApp,WHATSAPP_REPLY,openai,GPT-4o mini,Comunicação,10,5,0.000004\r\n',
    )
    expect(
      toAiUsageCsvRow({ ...row, userName: null, userEmail: null }),
    ).toContain(',Usuário removido,,')
    expect(
      toAiUsageCsvRow({
        ...row,
        userId: null,
        userName: null,
        userEmail: null,
        feature: 'ODD' as never,
        module: 'CRM',
      }),
    ).toContain(',Automações (sem usuário),,ODD,ODD,openai,GPT-4o mini,CRM,')
    expect(AI_USAGE_ROWS_CSV_HEADER).toHaveLength(11)
  })

  it('writes an aggregated item with its share in percent', () => {
    expect(
      toAiUsageAggregateCsvRow({
        key: 'CRM',
        label: 'CRM',
        detail: null,
        costUsd: 1.5,
        inputTokens: 10,
        outputTokens: 2,
        calls: 3,
        share: 0.123456,
      }),
    ).toBe('CRM,CRM,,3,10,2,1.5,12.35\r\n')
    expect(AI_USAGE_AGGREGATE_CSV_HEADER).toHaveLength(8)
  })
})
