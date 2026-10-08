import { describe, expect, it } from 'vitest'
import {
  AiUsageAnalyticsQuerySchema,
  AiUsageExportQuerySchema,
} from '../ai-usage.schema'

function messages(result: { success: boolean; error?: { issues: unknown } }) {
  return JSON.stringify(result.error?.issues ?? [])
}

describe('AiUsageAnalyticsQuerySchema', () => {
  it('defaults to the personal scope and this month', () => {
    expect(AiUsageAnalyticsQuerySchema.parse({})).toEqual({
      scope: 'personal',
      period: 'this_month',
    })
  })

  it('accepts presets and a valid custom range', () => {
    expect(
      AiUsageAnalyticsQuerySchema.parse({
        scope: 'workspace',
        period: 'last_90_days',
      }).period,
    ).toBe('last_90_days')
    expect(
      AiUsageAnalyticsQuerySchema.safeParse({
        period: 'custom',
        from: '2026-01-01',
        to: '2026-12-31',
      }).success,
    ).toBe(true)
  })

  it('ignores from/to outside a custom period', () => {
    expect(
      AiUsageAnalyticsQuerySchema.safeParse({
        period: 'last_7_days',
        from: '2026-01-01',
      }).success,
    ).toBe(true)
  })

  it('rejects unknown scopes, periods and malformed days', () => {
    expect(
      AiUsageAnalyticsQuerySchema.safeParse({ scope: 'everyone' }).success,
    ).toBe(false)
    expect(
      AiUsageAnalyticsQuerySchema.safeParse({ period: 'ever' }).success,
    ).toBe(false)
    const bad = AiUsageAnalyticsQuerySchema.safeParse({
      period: 'custom',
      from: '2026-02-30',
      to: '2026-03-01',
    })
    expect(messages(bad)).toContain('AAAA-MM-DD')
  })

  it('requires both ends of a custom range', () => {
    const noFrom = AiUsageAnalyticsQuerySchema.safeParse({
      period: 'custom',
      to: '2026-03-01',
    })
    expect(messages(noFrom)).toContain('"from"')
    const noTo = AiUsageAnalyticsQuerySchema.safeParse({
      period: 'custom',
      from: '2026-03-01',
    })
    expect(messages(noTo)).toContain('"to"')
  })

  it('rejects an inverted or too long custom range', () => {
    expect(
      messages(
        AiUsageAnalyticsQuerySchema.safeParse({
          period: 'custom',
          from: '2026-03-02',
          to: '2026-03-01',
        }),
      ),
    ).toContain('posterior')
    expect(
      messages(
        AiUsageAnalyticsQuerySchema.safeParse({
          period: 'custom',
          from: '2025-01-01',
          to: '2026-01-02',
        }),
      ),
    ).toContain('366')
  })
})

describe('AiUsageExportQuerySchema', () => {
  it('defaults to the raw rows view and validates the view', () => {
    expect(AiUsageExportQuerySchema.parse({}).view).toBe('rows')
    expect(AiUsageExportQuerySchema.parse({ view: 'user' }).view).toBe('user')
    expect(AiUsageExportQuerySchema.safeParse({ view: 'xlsx' }).success).toBe(
      false,
    )
  })

  it('applies the custom range checks', () => {
    expect(
      AiUsageExportQuerySchema.safeParse({ period: 'custom' }).success,
    ).toBe(false)
  })
})
