import { describe, expect, it, vi } from 'vitest'
import { runApl, tabularToRows } from '../analytics/axiom-query'
import { resolveAnalyticsConfig } from '../analytics/config'
import * as fx from '../analytics/fixtures'
import { bucketStarts, resolveWindow } from '../analytics/time-range'

const window = {
  from: new Date('2026-09-19T11:00:00Z'),
  to: new Date('2026-09-19T12:00:00Z'),
}
const options = { token: 'xaat-test', url: 'https://api.axiom.co/' }

const tabular = {
  tables: [
    {
      fields: [{ name: 'route' }, { name: 'requests' }],
      columns: [
        ['/a', '/b'],
        [3, 1],
      ],
    },
  ],
}

describe('tabularToRows()', () => {
  it('turns columns into row objects', () => {
    expect(tabularToRows(tabular)).toEqual([
      { route: '/a', requests: 3 },
      { route: '/b', requests: 1 },
    ])
  })

  it('handles missing tables and empty columns', () => {
    expect(tabularToRows({})).toEqual([])
    expect(tabularToRows({ tables: [{ fields: [], columns: [] }] })).toEqual([])
  })
})

describe('runApl()', () => {
  it('posts the APL with the window and a bearer token', async () => {
    const fetchImpl = vi.fn(async () => Response.json(tabular))
    const result = await runApl('x | count', window, { ...options, fetchImpl })

    expect(result).toEqual({ ok: true, value: tabularToRows(tabular) })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('https://api.axiom.co/v1/datasets/_apl?format=tabular')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer xaat-test',
    )
    expect(JSON.parse(init.body as string)).toEqual({
      apl: 'x | count',
      startTime: '2026-09-19T11:00:00.000Z',
      endTime: '2026-09-19T12:00:00.000Z',
    })
  })

  it('reports the Axiom error message on non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ message: 'invalid field: "x"\n\n^^^' }, { status: 400 }),
    )
    const result = await runApl('bad', window, { ...options, fetchImpl })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ANALYTICS_QUERY_FAILED')
    expect(result.error.message).toBe('Axiom respondeu 400: invalid field: "x"')
  })

  it('keeps only the status when the error body is not JSON', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('Bad Gateway', { status: 502 }),
    )
    const result = await runApl('x', window, { ...options, fetchImpl })
    expect(!result.ok && result.error.message).toBe('Axiom respondeu 502')
  })

  it('handles a JSON error body without message', async () => {
    const fetchImpl = vi.fn(async () => Response.json({}, { status: 403 }))
    const result = await runApl('x', window, { ...options, fetchImpl })
    expect(!result.ok && result.error.message).toBe('Axiom respondeu 403')
  })

  it('maps timeouts and network errors', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' })
    const r1 = await runApl('x', window, {
      ...options,
      fetchImpl: vi.fn(async () => {
        throw timeout
      }),
    })
    expect(!r1.ok && r1.error.message).toBe('Axiom não respondeu a tempo')

    const r2 = await runApl('x', window, {
      ...options,
      fetchImpl: vi.fn(async () => {
        throw new Error('ECONNRESET')
      }),
    })
    expect(!r2.ok && r2.error.message).toBe(
      'Falha ao consultar o Axiom: ECONNRESET',
    )

    const r3 = await runApl('x', window, {
      ...options,
      fetchImpl: vi.fn(() => Promise.reject('down')),
    })
    expect(!r3.ok && r3.error.message).toBe('Falha ao consultar o Axiom: down')
  })

  it('uses the global fetch by default', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(tabular))
    const result = await runApl('x', window, options)
    expect(result.ok).toBe(true)
    expect(spy).toHaveBeenCalledOnce()
  })
})

describe('resolveAnalyticsConfig()', () => {
  it('serves fixtures only outside production', () => {
    expect(
      resolveAnalyticsConfig({ nodeEnv: 'development', fixtures: 'true' })
        .source,
    ).toBe('fixtures')
    expect(
      resolveAnalyticsConfig({
        nodeEnv: 'production',
        fixtures: 'true',
        token: 'xaat-1',
      }).source,
    ).toBe('axiom')
    expect(
      resolveAnalyticsConfig({ nodeEnv: 'production', fixtures: 'true' })
        .source,
    ).toBe('unconfigured')
  })

  it('uses the token, url and dataset with defaults', () => {
    expect(
      resolveAnalyticsConfig({
        nodeEnv: 'production',
        token: 'xaat-1',
        url: 'https://eu.axiom.co',
        dataset: 'ds',
      }),
    ).toEqual({
      source: 'axiom',
      token: 'xaat-1',
      url: 'https://eu.axiom.co',
      dataset: 'ds',
    })
    expect(resolveAnalyticsConfig({})).toEqual({
      source: 'unconfigured',
      url: 'https://api.axiom.co',
      dataset: 'steel-app',
    })
  })

  it('reads the typed env by default', () => {
    expect(['axiom', 'fixtures', 'unconfigured']).toContain(
      resolveAnalyticsConfig().source,
    )
  })
})

describe('time windows', () => {
  it('resolves range, bin and aligned buckets', () => {
    const now = new Date('2026-09-19T12:00:30Z')
    const w = resolveWindow('1h', now)
    expect(w.bin).toBe('1m')
    expect(w.from.toISOString()).toBe('2026-09-19T11:00:30.000Z')
    const buckets = bucketStarts(w)
    expect(buckets[0].toISOString()).toBe('2026-09-19T11:00:00.000Z')
    expect(buckets.at(-1)?.toISOString()).toBe('2026-09-19T12:00:00.000Z')
    expect(buckets).toHaveLength(61)
    expect(resolveWindow('30d', now).bin).toBe('6h')
  })
})

describe('fixtures', () => {
  const w = resolveWindow('24h', new Date('2026-09-17T18:00:00Z'))

  it('are deterministic and internally consistent', () => {
    const a = fx.fixtureTrafficSeries(w, {})
    expect(fx.fixtureTrafficSeries(w, {})).toEqual(a)
    expect(a).toHaveLength(bucketStarts(w).length)
    const totals = fx.fixtureTrafficTotals(w, {})
    expect(totals.requests).toBe(a.reduce((s, p) => s + p.requests, 0))
    expect(totals.requests).toBeGreaterThan(1000)
    expect(totals.p95).toBeGreaterThan(totals.p50 as number)
    const routes = fx.fixtureRoutes(w, {})
    expect(routes.reduce((s, r) => s + r.requests, 0)).toBe(totals.requests)
    expect(routes[0].requests).toBeGreaterThanOrEqual(routes[1].requests)
  })

  it('narrow with the filters', () => {
    const all = fx.fixtureTrafficTotals(w, {})
    const ws = fx.fixtureTrafficTotals(w, { workspace: 'w1' })
    expect(ws.requests).toBeLessThan(all.requests)
    expect(ws.workspaces).toBe(1)
    const route = fx.fixtureRoutes(w, {
      route: '/api/workspaces/[id]/crm/ai/chat',
    })
    expect(
      route.every((r) => r.route === '/api/workspaces/[id]/crm/ai/chat'),
    ).toBe(true)
    const only5xx = fx.fixtureTrafficTotals(w, { status: '5xx' })
    expect(only5xx.errors4xx).toBe(0)
    expect(only5xx.errors5xx).toBe(only5xx.requests)
    expect(fx.fixtureTrafficTotals(w, { status: '3xx' })).toMatchObject({
      requests: 0,
      p50: null,
      users: 0,
      workspaces: 0,
    })
    expect(
      fx.fixtureTrafficTotals(w, { env: 'development' }).requests,
    ).toBeLessThan(all.requests)
    expect(fx.fixtureTrafficTotals(w, { env: 'test' }).requests).toBeLessThan(
      all.requests,
    )
    expect(fx.fixtureTrafficTotals(w, { status: '2xx' }).errors4xx).toBe(0)
  })

  it('produce every panel of the other tabs', () => {
    const statuses = fx.fixtureStatuses(w, {})
    expect(statuses.map((s) => s.status)).toContain(200)
    expect(statuses.some((s) => s.status >= 500)).toBe(true)
    const groups = fx.fixtureErrorGroups(w, {})
    expect(groups.length).toBeGreaterThan(3)
    expect(groups[0].count).toBeGreaterThanOrEqual(groups[1].count)
    const samples = fx.fixtureErrorSamples(w, {}, 10)
    expect(samples).toHaveLength(10)
    expect(samples[0].t >= samples[9].t).toBe(true)
    expect(fx.fixtureErrorTrend(w, {})).toHaveLength(bucketStarts(w).length)
    expect(fx.fixtureActivity(w, {}).some((p) => p.users > 0)).toBe(true)
    const access = fx.fixtureAccessTotals(w, {})
    expect(access.pageViews).toBeGreaterThan(0)
    const countries = fx.fixtureCountries(w, {})
    expect(countries[0]).toMatchObject({ country: 'Brasil', countryCode: 'BR' })
    expect(fx.fixtureCities(w, {})[0].city).toBe('São Paulo')
    const clients = fx.fixtureClients(w, {})
    expect(clients.browsers[0].name).toBe('Chrome')
    expect(clients.devices.map((d) => d.name)).toContain('Celular')
    expect(fx.FIXTURE_ROUTES.length).toBeGreaterThan(5)
  })

  it('return empty error panels when there is no traffic', () => {
    expect(fx.fixtureErrorSamples(w, { status: '3xx' })).toEqual([])
    expect(fx.fixtureErrorGroups(w, { status: '3xx' })).toEqual([])
    expect(fx.fixtureStatuses(w, { status: '3xx' })).toEqual([])
    expect(
      fx
        .fixtureStatuses(w, { route: '/api/auth/get-session' })
        .every((s) => s.status < 500 || s.status === 500),
    ).toBe(true)
  })

  it('have less traffic on weekends and at night', () => {
    const weekday = fx.fixtureTrafficTotals(
      resolveWindow('1h', new Date('2026-09-17T17:00:00Z')),
      {},
    )
    const sunday = fx.fixtureTrafficTotals(
      resolveWindow('1h', new Date('2026-09-20T17:00:00Z')),
      {},
    )
    const night = fx.fixtureTrafficTotals(
      resolveWindow('1h', new Date('2026-09-17T07:00:00Z')),
      {},
    )
    expect(sunday.requests).toBeLessThan(weekday.requests)
    expect(night.requests).toBeLessThan(weekday.requests)
  })
})
