import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  AnalyticsQuerySchema,
  AnalyticsResultSchema,
  AnalyticsRouteSchema,
  panel,
} from '../admin-analytics.schema'

describe('AnalyticsQuerySchema', () => {
  it('defaults to the overview of the last hour', () => {
    expect(AnalyticsQuerySchema.parse({})).toEqual({
      view: 'overview',
      range: '1h',
    })
  })

  it('treats empty query-string values as absent', () => {
    expect(
      AnalyticsQuerySchema.parse({
        view: '',
        range: '',
        workspace: '',
        route: '',
        status: '',
        env: '',
      }),
    ).toEqual({ view: 'overview', range: '1h' })
  })

  it('accepts every filter', () => {
    const parsed = AnalyticsQuerySchema.parse({
      view: 'route',
      range: '7d',
      workspace: 'k3v9x0q2m1n8b7c6z5a4s3d2',
      route: '/api/workspaces/[id]/crm/leads',
      status: '5xx',
      env: 'production',
    })
    expect(parsed.route).toBe('/api/workspaces/[id]/crm/leads')
    expect(parsed.status).toBe('5xx')
  })

  it.each([
    ['view', 'pages'],
    ['range', '90d'],
    ['status', '6xx'],
    ['env', 'staging'],
    ['workspace', 'x"; drop'],
  ])('rejects an invalid %s', (key, value) => {
    expect(AnalyticsQuerySchema.safeParse({ [key]: value }).success).toBe(false)
  })
})

describe('AnalyticsRouteSchema', () => {
  it('rejects values that are not a path', () => {
    expect(AnalyticsRouteSchema.safeParse('api/x').success).toBe(false)
    expect(AnalyticsRouteSchema.safeParse('/api/x" | take 1').success).toBe(
      false,
    )
    expect(AnalyticsRouteSchema.safeParse(`/${'a'.repeat(200)}`).success).toBe(
      false,
    )
  })
})

describe('panel()', () => {
  const schema = panel(z.number())
  it('accepts data or an error, never both shapes mixed', () => {
    expect(schema.safeParse({ ok: true, data: 1 }).success).toBe(true)
    expect(schema.safeParse({ ok: false, error: 'falhou' }).success).toBe(true)
    expect(schema.safeParse({ ok: true, error: 'x' }).success).toBe(false)
  })
})

describe('AnalyticsResultSchema', () => {
  const meta = {
    source: 'unconfigured',
    range: '1h',
    bin: '1m',
    binSeconds: 60,
    from: '2026-09-19T11:00:00.000Z',
    to: '2026-09-19T12:00:00.000Z',
    generatedAt: '2026-09-19T12:00:00.000Z',
    cached: false,
  }
  it('describes the unconfigured state', () => {
    expect(
      AnalyticsResultSchema.safeParse({
        view: 'overview',
        meta,
        unconfigured: true,
      }).success,
    ).toBe(true)
  })

  it('describes a jobs view with a failed panel', () => {
    expect(
      AnalyticsResultSchema.safeParse({
        view: 'jobs',
        meta: { ...meta, source: 'axiom' },
        queues: { ok: false, error: 'Redis fora' },
        failures: { ok: true, data: [] },
      }).success,
    ).toBe(true)
  })
})
