import { describe, expect, it } from 'vitest'
import {
  AI_USAGE_FEATURE_KEYS,
  AI_USAGE_FEATURE_LABELS,
  aiUsageModelLabel,
  aiUsageModuleKey,
} from '../ai/usage-labels'
import {
  addUtcDays,
  addUtcMonths,
  daysBetween,
  parseUtcDay,
  resolveAiUsagePeriod,
  startOfUtcDay,
  startOfUtcMonth,
  startOfUtcWeek,
  utcDayKey,
} from '../ai/usage-period'

// Wednesday, 2026-10-07 13:45 UTC.
const NOW = new Date('2026-10-07T13:45:00.000Z')
const iso = (d: Date) => d.toISOString()

describe('usage-period', () => {
  it('computes UTC day, ISO week (Monday) and month starts', () => {
    expect(iso(startOfUtcDay(NOW))).toBe('2026-10-07T00:00:00.000Z')
    expect(iso(startOfUtcWeek(NOW))).toBe('2026-10-05T00:00:00.000Z')
    // Sunday belongs to the week that started on the Monday before.
    expect(iso(startOfUtcWeek(new Date('2026-10-11T23:59:00Z')))).toBe(
      '2026-10-05T00:00:00.000Z',
    )
    expect(iso(startOfUtcMonth(NOW))).toBe('2026-10-01T00:00:00.000Z')
    expect(iso(addUtcMonths(startOfUtcMonth(NOW), -10))).toBe(
      '2025-12-01T00:00:00.000Z',
    )
    expect(utcDayKey(addUtcDays(NOW, 1))).toBe('2026-10-08')
    expect(
      daysBetween(new Date('2026-02-01T00:00Z'), new Date('2026-03-01T00:00Z')),
    ).toBe(28)
  })

  it('parses only real YYYY-MM-DD days', () => {
    expect(iso(parseUtcDay('2026-02-28') as Date)).toBe(
      '2026-02-28T00:00:00.000Z',
    )
    expect(parseUtcDay('2026-02-30')).toBeNull()
    expect(parseUtcDay('07/10/2026')).toBeNull()
  })

  it.each([
    ['this_month', '2026-10-01', '2026-10-08'],
    ['last_month', '2026-09-01', '2026-10-01'],
    ['last_7_days', '2026-10-01', '2026-10-08'],
    ['last_30_days', '2026-09-08', '2026-10-08'],
    ['last_90_days', '2026-07-10', '2026-10-08'],
  ] as const)('resolves %s to [%s, %s)', (period, from, to) => {
    const range = resolveAiUsagePeriod({ period }, NOW)
    expect(utcDayKey(range.from)).toBe(from)
    expect(utcDayKey(range.to)).toBe(to)
  })

  it('resolves a custom range with an inclusive last day', () => {
    const range = resolveAiUsagePeriod(
      { period: 'custom', from: '2026-08-15', to: '2026-09-14' },
      NOW,
    )
    expect(utcDayKey(range.from)).toBe('2026-08-15')
    expect(utcDayKey(range.to)).toBe('2026-09-15')
  })

  it('falls back to month-to-date for an incomplete custom range', () => {
    const range = resolveAiUsagePeriod({ period: 'custom' }, NOW)
    expect(utcDayKey(range.from)).toBe('2026-10-01')
    expect(utcDayKey(range.to)).toBe('2026-10-08')
  })

  it('defaults to the current month with the real clock', () => {
    const range = resolveAiUsagePeriod({ period: 'this_month' })
    expect(range.from.getUTCDate()).toBe(1)
  })
})

describe('usage-labels', () => {
  it('labels every ledger feature in pt-BR', () => {
    for (const key of AI_USAGE_FEATURE_KEYS) {
      expect(AI_USAGE_FEATURE_LABELS[key]).toMatch(/\S/)
    }
  })

  it('derives the module scope: row module, then the feature module, then platform', () => {
    expect(aiUsageModuleKey('STEEL_ASSISTANT', 'CRM')).toBe('CRM')
    expect(aiUsageModuleKey('WHATSAPP_REPLY', null)).toBe('COMMUNICATION')
    expect(aiUsageModuleKey('SERVICEDESK_TRIAGE', null)).toBe('SERVICE_DESK')
    expect(aiUsageModuleKey('STEEL_AGENT', null)).toBe('PLATFORM')
  })

  it('labels catalog models and keeps unknown model ids', () => {
    expect(aiUsageModelLabel('openai', 'gpt-4o-mini')).toBe('GPT-4o mini')
    expect(aiUsageModelLabel('openai', 'gpt-retired')).toBe('gpt-retired')
  })
})
