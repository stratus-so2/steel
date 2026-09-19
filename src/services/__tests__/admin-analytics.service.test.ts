import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { analyticsQueryFailed, databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/cache/analytics.cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/cache/analytics.cache')>()),
  AnalyticsCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))
vi.mock('@/src/lib/queue/health', () => ({
  getQueueHealth: vi.fn(),
  getRecentJobFailures: vi.fn(),
}))
vi.mock('@/src/lib/analytics/axiom-query', () => ({ runApl: vi.fn() }))

import { AnalyticsCache } from '@/src/cache/analytics.cache'
import { runApl } from '@/src/lib/analytics/axiom-query'
import type { AnalyticsConfig } from '@/src/lib/analytics/config'
import { getQueueHealth, getRecentJobFailures } from '@/src/lib/queue/health'
import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import type {
  AnalyticsQuery,
  AnalyticsResultDTO,
} from '@/src/schemas/admin-analytics.schema'
import { AdminAnalyticsService } from '../admin-analytics.service'

const NOW = new Date('2026-09-17T18:00:00Z')
const admin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})
const AXIOM: AnalyticsConfig = {
  source: 'axiom',
  token: 'xaat-test',
  url: 'https://api.axiom.co',
  dataset: 'steel-app',
}
const FIXTURES: AnalyticsConfig = {
  source: 'fixtures',
  url: 'https://api.axiom.co',
  dataset: 'steel-app',
}
const UNCONFIGURED: AnalyticsConfig = { ...FIXTURES, source: 'unconfigured' }

const q = (partial: Partial<AnalyticsQuery> = {}): AnalyticsQuery => ({
  view: 'overview',
  range: '1h',
  ...partial,
})

const get = (query: AnalyticsQuery, config: AnalyticsConfig = AXIOM) =>
  AdminAnalyticsService.get(admin.id, query, NOW, config)

/** Resposta do Axiom por consulta, reconhecida pelo texto do APL. */
function axiomAnswers(fail: (apl: string) => boolean = () => false) {
  vi.mocked(runApl).mockImplementation(async (apl) => {
    if (fail(apl)) return err(analyticsQueryFailed('Axiom respondeu 400'))
    if (apl.includes('pageViews = count()')) return ok([{ pageViews: 42 }])
    if (apl.includes('by country')) {
      return ok([{ country: 'Brasil', countryCode: 'BR', count: 30 }])
    }
    if (apl.includes('by city')) {
      return ok([{ city: 'Recife', country: 'Brasil', count: 12 }])
    }
    if (apl.includes('by browser')) {
      return ok([
        { browser: 'Chrome', os: 'Windows', device: 'desktop', count: 30 },
      ])
    }
    if (apl.includes('by route, method')) {
      return ok([{ route: '/api/x', method: 'GET', requests: 10, p95: 80 }])
    }
    if (apl.includes('lastSeen')) {
      return ok([{ status: 500, route: '/api/x', count: 2, lastSeen: 1 }])
    }
    if (apl.includes('by status')) return ok([{ status: 200, count: 10 }])
    if (apl.includes('| project _time')) {
      return ok([
        { _time: '2026-09-17T17:59:00Z', status: 500, route: '/api/x' },
      ])
    }
    if (apl.includes('by bin(_time')) {
      return ok([{ _time: '2026-09-17T17:30:00Z', requests: 60, users: 2 }])
    }
    return ok([{ requests: 100, errors4xx: 3, users: 5, workspaces: 2 }])
  })
}

beforeEach(() => {
  vi.mocked(UserRepository.findById).mockResolvedValue(ok(admin))
  vi.mocked(AnalyticsCache.get).mockResolvedValue(null)
  axiomAnswers()
})

describe('AdminAnalyticsService.get() — access and state', () => {
  it('denies a non-platform-admin', async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(
      ok(createFakeUser({ email: 'x@example.com' })),
    )
    expectErr(await get(q()), 'FORBIDDEN')
    expect(runApl).not.toHaveBeenCalled()
  })

  it('requires the route for the route drill-down', async () => {
    expectErr(await get(q({ view: 'route' })), 'VALIDATION_ERROR')
  })

  it('returns the setup state without a token', async () => {
    const result = expectOk(await get(q({ range: '24h' }), UNCONFIGURED))
    expect(result).toMatchObject({
      view: 'overview',
      unconfigured: true,
      meta: { source: 'unconfigured', range: '24h', bin: '15m' },
    })
    expect(runApl).not.toHaveBeenCalled()
  })
})

describe('AdminAnalyticsService.get() — Axiom', () => {
  it('builds the overview with the meta of the window', async () => {
    const result = expectOk(await get(q({ env: 'production' })))
    if (result.view !== 'overview' || 'unconfigured' in result) {
      throw new Error('unexpected view')
    }
    expect(result.meta).toEqual({
      source: 'axiom',
      range: '1h',
      bin: '1m',
      binSeconds: 60,
      from: '2026-09-17T17:00:00.000Z',
      to: '2026-09-17T18:00:00.000Z',
      generatedAt: NOW.toISOString(),
      cached: false,
    })
    expect(result.totals).toEqual({
      ok: true,
      data: expect.objectContaining({ requests: 100, users: 5 }),
    })
    expect(result.series.ok && result.series.data).toHaveLength(61)
    const [apl, window, options] = vi.mocked(runApl).mock.calls[0]
    expect(apl).toContain(`== "production"`)
    expect(window.from.toISOString()).toBe('2026-09-17T17:00:00.000Z')
    expect(options).toEqual({ token: 'xaat-test', url: 'https://api.axiom.co' })
    expect(AnalyticsCache.set).toHaveBeenCalledOnce()
  })

  it('keeps the page up when one panel fails and skips the cache', async () => {
    axiomAnswers((apl) => apl.includes('by bin(_time'))
    const result = expectOk(await get(q()))
    if (result.view !== 'overview' || 'unconfigured' in result) {
      throw new Error('unexpected view')
    }
    expect(result.series).toEqual({ ok: false, error: 'Axiom respondeu 400' })
    expect(result.totals.ok).toBe(true)
    expect(AnalyticsCache.set).not.toHaveBeenCalled()
  })

  it('serves a cached result flagged as cached', async () => {
    const cached = {
      view: 'routes',
      meta: { source: 'axiom', cached: false },
      routes: { ok: true, data: [] },
    } as unknown as AnalyticsResultDTO
    vi.mocked(AnalyticsCache.get).mockResolvedValue(cached)
    const result = expectOk(await get(q({ view: 'routes' })))
    expect(result.meta.cached).toBe(true)
    expect(runApl).not.toHaveBeenCalled()
  })

  it('builds the routes, route, errors and access views', async () => {
    const routes = expectOk(await get(q({ view: 'routes' })))
    expect(routes).toMatchObject({
      view: 'routes',
      routes: { ok: true, data: [{ route: '/api/x', requests: 10 }] },
    })

    const route = expectOk(
      await get(q({ view: 'route', route: '/api/x', status: '5xx' })),
    )
    expect(route).toMatchObject({
      view: 'route',
      route: '/api/x',
      statuses: { ok: true, data: [{ status: 200, count: 10 }] },
      recentErrors: { ok: true, data: [{ status: 500 }] },
    })
    expect(
      vi
        .mocked(runApl)
        .mock.calls.some(([apl]) => apl.includes('where route == "/api/x"')),
    ).toBe(true)

    const errors = expectOk(await get(q({ view: 'errors' })))
    expect(errors).toMatchObject({
      view: 'errors',
      groups: { ok: true, data: [{ status: 500, count: 2 }] },
      trend: { ok: true },
      samples: { ok: true },
    })

    const access = expectOk(await get(q({ view: 'access' })))
    expect(access).toMatchObject({
      view: 'access',
      totals: { ok: true, data: { users: 5, workspaces: 2, pageViews: 42 } },
      countries: { ok: true, data: [{ country: 'Brasil' }] },
      cities: { ok: true, data: [{ city: 'Recife' }] },
      browsers: { ok: true, data: [{ name: 'Chrome', count: 30 }] },
      os: { ok: true, data: [{ name: 'Windows' }] },
      devices: { ok: true, data: [{ name: 'Desktop' }] },
    })
  })

  it('reports failed access panels individually', async () => {
    axiomAnswers(
      (apl) =>
        apl.includes('by browser') || apl.includes('pageViews = count()'),
    )
    const access = expectOk(await get(q({ view: 'access' })))
    expect(access).toMatchObject({
      totals: { ok: false },
      browsers: { ok: false, error: 'Axiom respondeu 400' },
      devices: { ok: false },
      countries: { ok: true },
    })

    axiomAnswers((apl) => apl.includes('dcountif') && !apl.includes('bin('))
    const again = expectOk(await get(q({ view: 'access' })))
    expect(again).toMatchObject({ totals: { ok: false } })
  })

  it('filters page views by the workspace slug', async () => {
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      ok(createFakeWorkspace({ id: 'k3v9x0q2m1n8b7c6z5a4s3d2', slug: 'acme' })),
    )
    expectOk(
      await get(q({ view: 'access', workspace: 'k3v9x0q2m1n8b7c6z5a4s3d2' })),
    )
    expect(
      vi
        .mocked(runApl)
        .mock.calls.some(([apl]) =>
          apl.includes('where workspaceSlug == "acme"'),
        ),
    ).toBe(true)
  })

  it('rejects an unknown workspace and propagates repository errors', async () => {
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(notFound('Workspace')),
    )
    expectErr(
      await get(q({ view: 'access', workspace: 'k3v9x0q2m1n8b7c6z5a4s3d2' })),
      'RESOURCE_NOT_FOUND',
    )
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError()),
    )
    expectErr(
      await get(q({ view: 'access', workspace: 'k3v9x0q2m1n8b7c6z5a4s3d2' })),
      'DATABASE_ERROR',
    )
  })
})

describe('AdminAnalyticsService.get() — fixtures', () => {
  it.each([
    'overview',
    'routes',
    'errors',
    'access',
  ] as const)('serves the %s view without Axiom or cache', async (view) => {
    const result = expectOk(await get(q({ view, range: '24h' }), FIXTURES))
    expect(result.view).toBe(view)
    expect(result.meta.source).toBe('fixtures')
    expect(JSON.stringify(result)).not.toContain('"ok":false')
    expect(runApl).not.toHaveBeenCalled()
    expect(AnalyticsCache.get).not.toHaveBeenCalled()
    expect(AnalyticsCache.set).not.toHaveBeenCalled()
  })

  it('serves the route drill-down', async () => {
    const result = expectOk(
      await get(
        q({ view: 'route', route: '/api/workspaces/[id]/crm/leads' }),
        FIXTURES,
      ),
    )
    expect(result).toMatchObject({ view: 'route', series: { ok: true } })
  })
})

describe('AdminAnalyticsService.get() — jobs', () => {
  it('reads the queues and recent failures even without Axiom', async () => {
    vi.mocked(getQueueHealth).mockResolvedValue([
      {
        name: 'database-backup',
        waiting: 1,
        active: 0,
        delayed: 2,
        failed: 3,
        completed: 9,
      },
    ])
    vi.mocked(getRecentJobFailures).mockResolvedValue([
      {
        queue: 'database-backup',
        jobId: '7',
        jobName: 'run-full-backup',
        reason: 'pg_dump saiu com 1',
        attempts: 3,
        failedAt: '2026-09-17T17:00:00.000Z',
      },
    ])
    const result = expectOk(await get(q({ view: 'jobs' }), UNCONFIGURED))
    expect(result).toMatchObject({
      view: 'jobs',
      meta: { source: 'unconfigured' },
      queues: { ok: true, data: [{ name: 'database-backup', failed: 3 }] },
      failures: { ok: true, data: [{ jobName: 'run-full-backup' }] },
    })
  })

  it('degrades each jobs panel on Redis errors', async () => {
    vi.mocked(getQueueHealth).mockRejectedValue(new Error('Redis fora'))
    vi.mocked(getRecentJobFailures).mockRejectedValue('x')
    const result = expectOk(await get(q({ view: 'jobs' })))
    expect(result).toMatchObject({
      queues: { ok: false, error: 'Redis fora' },
      failures: { ok: false, error: 'Falha ao ler as filas' },
    })
  })
})

describe('AdminAnalyticsService.get() — default config', () => {
  it('resolves the config from env when none is passed', async () => {
    const result = expectOk(
      await AdminAnalyticsService.get(admin.id, q({ view: 'jobs' })),
    )
    expect(result.view).toBe('jobs')
  })
})
