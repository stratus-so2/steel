import { describe, expect, it } from 'vitest'
import { ChartConfigSchema, ViewConfigSchema } from '../crm-dashboard.schema'
import {
  SD_DASHBOARD_ROW_LIMITS,
  SD_DASHBOARD_SOURCES,
  SdDashboardSourceParamsSchema,
  SdDashboardSourceSchema,
} from '../sd-dashboard.schema'
import { SubmitSdTicketCsatSchema } from '../sd-ticket-csat.schema'

describe('SdDashboardSourceSchema', () => {
  it('accepts every ServiceDesk source and rejects others', () => {
    for (const source of SD_DASHBOARD_SOURCES) {
      expect(SdDashboardSourceSchema.parse(source)).toBe(source)
      expect(SD_DASHBOARD_ROW_LIMITS[source]).toBeGreaterThan(0)
    }
    expect(SdDashboardSourceSchema.safeParse('companies').success).toBe(false)
    expect(
      SdDashboardSourceParamsSchema.safeParse({ source: 'sd-tickets' }).success,
    ).toBe(true)
  })
})

describe('dashboard engine extensions', () => {
  it('accepts ServiceDesk sources, aggregation, buckets and periods', () => {
    const parsed = ChartConfigSchema.parse({
      chartType: 'aggregate',
      source: 'sd-tickets',
      aggregation: 'avg',
      dateBucket: 'week',
      period: 'month',
      periodField: 'resolvedAt',
      limit: 10,
      title: 'MTTR',
      color: '#ef4444',
      decimals: 1,
    })
    expect(parsed).toMatchObject({ aggregation: 'avg', color: '#ef4444' })
    expect(
      ViewConfigSchema.parse({
        source: 'sd-kb-articles',
        limit: 5,
        period: 'today',
      }).limit,
    ).toBe(5)
  })

  it('keeps legacy configs unchanged (new fields are optional)', () => {
    const parsed = ChartConfigSchema.parse({ chartType: 'vertical' })
    expect(parsed).not.toHaveProperty('aggregation')
    expect(parsed).not.toHaveProperty('title')
  })

  it('rejects invalid colors, limits and aggregations', () => {
    expect(
      ChartConfigSchema.safeParse({ chartType: 'aggregate', color: 'red' })
        .success,
    ).toBe(false)
    expect(
      ChartConfigSchema.safeParse({ chartType: 'pie', limit: 0 }).success,
    ).toBe(false)
    expect(
      ChartConfigSchema.safeParse({ chartType: 'pie', aggregation: 'median' })
        .success,
    ).toBe(false)
  })
})

describe('SubmitSdTicketCsatSchema', () => {
  it('accepts 1–5 stars and trims the comment', () => {
    expect(
      SubmitSdTicketCsatSchema.parse({ score: 5, comment: '  Ótimo  ' }),
    ).toEqual({ score: 5, comment: 'Ótimo' })
    expect(SubmitSdTicketCsatSchema.parse({ score: 1, comment: '  ' })).toEqual(
      { score: 1, comment: undefined },
    )
  })

  it('rejects scores out of range, fractions and long comments', () => {
    for (const score of [0, 6, 2.5, '4']) {
      expect(SubmitSdTicketCsatSchema.safeParse({ score }).success).toBe(false)
    }
    expect(
      SubmitSdTicketCsatSchema.safeParse({
        score: 3,
        comment: 'x'.repeat(2001),
      }).success,
    ).toBe(false)
  })
})
