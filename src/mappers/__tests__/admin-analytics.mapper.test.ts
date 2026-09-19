import { describe, expect, it } from 'vitest'
import { resolveWindow } from '@/src/lib/analytics/time-range'
import {
  toAccessTotals,
  toActivity,
  toCities,
  toClientBreakdown,
  toCountries,
  toErrorGroups,
  toErrorSamples,
  toErrorTrend,
  toIso,
  toRouteStats,
  toStatusCounts,
  toTrafficPoints,
  toTrafficTotals,
} from '../admin-analytics.mapper'

// 15 min, baldes de 30 s → 31 baldes a partir de 11:45:00.
const window = resolveWindow('15m', new Date('2026-09-19T12:00:00Z'))

describe('toIso()', () => {
  it('reads ISO strings and epoch in ms, µs and ns', () => {
    const iso = '2026-09-19T12:00:00.000Z'
    const ms = Date.parse(iso)
    expect(toIso('2026-09-19T12:00:00Z')).toBe(iso)
    expect(toIso(ms)).toBe(iso)
    expect(toIso(ms * 1000)).toBe(iso)
    expect(toIso(ms * 1_000_000)).toBe(iso)
    expect(toIso('lixo')).toBe('1970-01-01T00:00:00.000Z')
  })
})

describe('toTrafficPoints()', () => {
  it('fills empty buckets and derives requests per minute', () => {
    const points = toTrafficPoints(
      [
        {
          _time: '2026-09-19T11:45:30Z',
          requests: 90,
          errors4xx: 3,
          errors5xx: 1,
          p50: 41.234,
          p95: 180,
          p99: null,
        },
      ],
      window,
    )
    expect(points).toHaveLength(31)
    expect(points[0]).toEqual({
      t: '2026-09-19T11:45:00.000Z',
      requests: 0,
      rpm: 0,
      errors4xx: 0,
      errors5xx: 0,
      p50: null,
      p95: null,
      p99: null,
    })
    expect(points[1]).toEqual({
      t: '2026-09-19T11:45:30.000Z',
      requests: 90,
      rpm: 180,
      errors4xx: 3,
      errors5xx: 1,
      p50: 41.2,
      p95: 180,
      p99: null,
    })
  })
})

describe('toTrafficTotals()', () => {
  it('coerces numbers and nulls', () => {
    expect(
      toTrafficTotals([
        {
          requests: '10',
          errors4xx: -1,
          errors5xx: 'x',
          p50: '',
          p95: 'NaN',
          p99: -5,
          users: 2.6,
          workspaces: 1,
        },
      ]),
    ).toEqual({
      requests: 10,
      errors4xx: 0,
      errors5xx: 0,
      p50: null,
      p95: null,
      p99: null,
      users: 3,
      workspaces: 1,
    })
    expect(toTrafficTotals([]).requests).toBe(0)
  })
})

describe('route/status/error rows', () => {
  it('maps route stats with fallbacks', () => {
    expect(
      toRouteStats([
        { route: '/api/x', method: 'GET', requests: 5, p50: 10, p95: 20 },
        { route: '', method: null, requests: 1 },
      ]),
    ).toEqual([
      {
        route: '/api/x',
        method: 'GET',
        requests: 5,
        errors4xx: 0,
        errors5xx: 0,
        p50: 10,
        p95: 20,
      },
      {
        route: '(sem rota)',
        method: '—',
        requests: 1,
        errors4xx: 0,
        errors5xx: 0,
        p50: null,
        p95: null,
      },
    ])
  })

  it('drops non-numeric statuses', () => {
    expect(
      toStatusCounts([
        { status: 200, count: 9 },
        { status: null, count: 1 },
        { status: 'abc', count: 1 },
      ]),
    ).toEqual([{ status: 200, count: 9 }])
  })

  it('maps error samples, scrubbing messages again', () => {
    expect(
      toErrorSamples([
        {
          _time: '2026-09-19T11:59:00Z',
          method: 'POST',
          route: '/api/x',
          status: 422,
          errorCode: '',
          errorMessage: 'e-mail ana@acme.com inválido',
          duration: 12,
        },
        { _time: 1, status: 500 },
      ]),
    ).toEqual([
      {
        t: '2026-09-19T11:59:00.000Z',
        method: 'POST',
        route: '/api/x',
        status: 422,
        code: null,
        message: 'e-mail [email] inválido',
        durationMs: 12,
      },
      {
        t: '1970-01-01T00:00:00.001Z',
        method: '—',
        route: '(sem rota)',
        status: 500,
        code: null,
        message: null,
        durationMs: null,
      },
    ])
  })

  it('maps error groups with the ns lastSeen', () => {
    const [group, fallback] = toErrorGroups([
      {
        status: 401,
        errorCode: 'UNAUTHORIZED',
        route: '/api/x',
        errorMessage: 'Nao autenticado',
        count: 7,
        lastSeen: 1789822294348000000,
      },
      { status: 500 },
    ])
    expect(group).toEqual({
      status: 401,
      code: 'UNAUTHORIZED',
      route: '/api/x',
      message: 'Nao autenticado',
      count: 7,
      lastSeen: '2026-09-19T12:51:34.348Z',
    })
    expect(fallback.route).toBe('(sem rota)')
  })
})

describe('series of the errors and access tabs', () => {
  it('fills the error trend and the activity', () => {
    const trend = toErrorTrend(
      [{ _time: '2026-09-19T12:00:00Z', errors4xx: 2, errors5xx: 1 }],
      window,
    )
    expect(trend.at(-1)).toEqual({
      t: '2026-09-19T12:00:00.000Z',
      errors4xx: 2,
      errors5xx: 1,
    })
    expect(trend[0].errors4xx).toBe(0)
    const activity = toActivity(
      [{ _time: '2026-09-19T11:45:00Z', users: 4, workspaces: 2 }],
      window,
    )
    expect(activity[0]).toEqual({
      t: '2026-09-19T11:45:00.000Z',
      users: 4,
      workspaces: 2,
    })
    expect(activity[1].users).toBe(0)
  })
})

describe('access rows', () => {
  it('combines unique totals and page views', () => {
    expect(
      toAccessTotals([{ users: 3, workspaces: 2 }], [{ pageViews: 50 }]),
    ).toEqual({
      users: 3,
      workspaces: 2,
      pageViews: 50,
    })
    expect(toAccessTotals([], [])).toEqual({
      users: 0,
      workspaces: 0,
      pageViews: 0,
    })
  })

  it('maps countries and cities, skipping blanks', () => {
    expect(
      toCountries([
        { country: 'Brasil', countryCode: 'BR', count: 9 },
        { country: '', countryCode: '', count: 1 },
        { country: 'Portugal', countryCode: '', count: 1 },
      ]),
    ).toEqual([
      { country: 'Brasil', countryCode: 'BR', count: 9 },
      { country: 'Portugal', countryCode: null, count: 1 },
    ])
    expect(
      toCities([
        { city: 'Recife', country: 'Brasil', count: 3 },
        { city: 'Lugar', country: '', count: 1 },
        { city: '', country: 'Brasil', count: 1 },
      ]),
    ).toEqual([
      { city: 'Recife', country: 'Brasil', count: 3 },
      { city: 'Lugar', country: '—', count: 1 },
    ])
  })

  it('splits the client breakdown into three rankings', () => {
    const out = toClientBreakdown([
      { browser: 'Chrome', os: 'Windows', device: 'desktop', count: 5 },
      { browser: 'Chrome', os: 'Android', device: 'mobile', count: 3 },
      { browser: 'Safari', os: 'iOS', device: 'mobile', count: 3 },
      { browser: 'unknown', os: '', device: 'robot', count: 1 },
    ])
    expect(out.browsers).toEqual([
      { name: 'Chrome', count: 8 },
      { name: 'Safari', count: 3 },
      { name: 'Desconhecido', count: 1 },
    ])
    expect(out.os[0]).toEqual({ name: 'Windows', count: 5 })
    expect(out.os).toContainEqual({ name: 'Desconhecido', count: 1 })
    expect(out.devices).toEqual([
      { name: 'Celular', count: 6 },
      { name: 'Desktop', count: 5 },
      { name: 'robot', count: 1 },
    ])
  })
})
