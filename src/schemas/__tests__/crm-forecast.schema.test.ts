import { describe, expect, it } from 'vitest'
import { ForecastSchema, GetCrmForecastSchema } from '../crm-forecast.schema'

describe('GetCrmForecastSchema', () => {
  it('should default to the monthly period', () => {
    expect(GetCrmForecastSchema.parse({})).toEqual({ period: 'MONTH' })
    expect(GetCrmForecastSchema.parse({ period: 'QUARTER' }).period).toBe(
      'QUARTER',
    )
  })

  it('should reject unsupported periods', () => {
    expect(GetCrmForecastSchema.safeParse({ period: 'YEAR' }).success).toBe(
      false,
    )
  })
})

describe('ForecastSchema', () => {
  const row = {
    ownerId: 'u1',
    ownerName: 'Ana',
    periodKey: '2026-09',
    wonAmount: 1000,
    weightedOpenAmount: 500,
    forecastAmount: 1500,
    openCount: 2,
    wonCount: 1,
    quotaAmount: 0,
    attainmentPct: null,
  }

  it('should accept rows without a quota (null attainment)', () => {
    expect(
      ForecastSchema.safeParse({ period: 'MONTH', rows: [row] }).success,
    ).toBe(true)
  })

  it('should reject rows missing numeric totals', () => {
    const { forecastAmount: _omit, ...incomplete } = row
    expect(
      ForecastSchema.safeParse({ period: 'MONTH', rows: [incomplete] }).success,
    ).toBe(false)
  })
})
