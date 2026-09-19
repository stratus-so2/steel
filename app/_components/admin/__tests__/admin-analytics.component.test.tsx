import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as fx from '@/src/lib/analytics/fixtures'
import { resolveWindow } from '@/src/lib/analytics/time-range'
import type {
  AnalyticsMeta,
  AnalyticsResultDTO,
} from '@/src/schemas/admin-analytics.schema'
import { AnalyticsDashboard } from '../analytics/analytics-dashboard'
import { AnalyticsFilters, analyticsHref } from '../analytics/analytics-filters'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('view=routes&range=24h'),
}))

const window = resolveWindow('24h', new Date('2026-09-17T18:00:00Z'))
const meta: AnalyticsMeta = {
  source: 'fixtures',
  range: '24h',
  bin: '15m',
  binSeconds: 900,
  from: window.from.toISOString(),
  to: window.to.toISOString(),
  generatedAt: window.to.toISOString(),
  cached: false,
}

describe('analyticsHref()', () => {
  it('patches the URL, dropping empty and "all" values', () => {
    const current = new URLSearchParams('view=routes&range=24h&status=5xx')
    expect(
      analyticsHref(current, { status: '__all__', env: 'production' }),
    ).toBe('/admin/analytics?view=routes&range=24h&env=production')
    expect(
      analyticsHref(new URLSearchParams('range=1h'), { range: undefined }),
    ).toBe('/admin/analytics')
  })
})

describe('AnalyticsFilters', () => {
  it('marks the active tab and range and hides filters on jobs', () => {
    const { rerender } = render(
      <AnalyticsFilters
        query={{ view: 'route', range: '24h', route: '/api/x' }}
        workspaces={[{ id: 'w1', name: 'Acme', slug: 'acme' }]}
      />,
    )
    expect(
      screen.getByRole('link', { name: 'Rotas' }).getAttribute('aria-current'),
    ).toBe('page')
    expect(
      screen.getByRole('button', { name: '24 h' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(screen.getByText(/Workspace:/)).toBeTruthy()

    rerender(
      <AnalyticsFilters
        query={{ view: 'jobs', range: '1h' }}
        workspaces={[]}
      />,
    )
    expect(screen.queryByText(/Workspace:/)).toBeNull()
  })
})

describe('AnalyticsDashboard', () => {
  it('shows the setup steps when Axiom is not configured', () => {
    render(
      <AnalyticsDashboard
        result={{
          view: 'overview',
          meta: { ...meta, source: 'unconfigured' },
          unconfigured: true,
        }}
      />,
    )
    expect(screen.getByText('Configure o AXIOM_QUERY_TOKEN')).toBeTruthy()
    expect(screen.getByText(/Fonte: não configurado/)).toBeTruthy()
  })

  it('renders the overview tiles and flags simulated data', () => {
    render(
      <AnalyticsDashboard
        result={{
          view: 'overview',
          meta,
          series: { ok: true, data: fx.fixtureTrafficSeries(window, {}) },
          totals: { ok: true, data: fx.fixtureTrafficTotals(window, {}) },
        }}
      />,
    )
    expect(screen.getByText('Requisições')).toBeTruthy()
    expect(screen.getByText('Latência p95')).toBeTruthy()
    expect(screen.getByText(/Simulado/)).toBeTruthy()
  })

  it('keeps the page up when a panel failed', () => {
    render(
      <AnalyticsDashboard
        result={{
          view: 'errors',
          meta: { ...meta, source: 'axiom' },
          groups: { ok: false, error: 'Axiom respondeu 400' },
          trend: { ok: true, data: [] },
          samples: {
            ok: true,
            data: fx.fixtureErrorSamples(window, {}, 3),
          },
        }}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain(
      'Axiom respondeu 400',
    )
    expect(screen.getByText('Amostras recentes')).toBeTruthy()
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })

  it.each([
    [
      'routes',
      {
        view: 'routes',
        meta,
        routes: { ok: true, data: fx.fixtureRoutes(window, {}) },
      },
      'Mais lentas',
    ],
    [
      'route',
      {
        view: 'route',
        meta,
        route: '/api/x',
        series: { ok: true, data: [] },
        statuses: { ok: true, data: [{ status: 200, count: 3 }] },
        recentErrors: { ok: true, data: [] },
      },
      'Erros recentes',
    ],
    [
      'access',
      {
        view: 'access',
        meta,
        totals: { ok: true, data: { users: 1, workspaces: 1, pageViews: 9 } },
        activity: { ok: true, data: [] },
        countries: { ok: true, data: [] },
        cities: { ok: true, data: [] },
        browsers: { ok: true, data: [{ name: 'Chrome', count: 9 }] },
        os: { ok: false, error: 'x' },
        devices: { ok: true, data: [] },
      },
      'GEOIP_DB_PATH',
    ],
    [
      'jobs',
      {
        view: 'jobs',
        meta,
        queues: {
          ok: true,
          data: [
            {
              name: 'database-backup',
              waiting: 0,
              active: 0,
              delayed: 0,
              failed: 2,
              completed: 1,
            },
          ],
        },
        failures: {
          ok: true,
          data: [
            {
              queue: 'database-backup',
              jobId: '1',
              jobName: 'run-full-backup',
              reason: 'pg_dump falhou',
              attempts: 3,
              failedAt: '2026-09-17T17:00:00.000Z',
            },
          ],
        },
      },
      'pg_dump falhou',
    ],
  ])('renders the %s view', (_view, result, text) => {
    render(<AnalyticsDashboard result={result as AnalyticsResultDTO} />)
    expect(
      screen.getAllByText(new RegExp(text as string)).length,
    ).toBeGreaterThan(0)
  })
})
