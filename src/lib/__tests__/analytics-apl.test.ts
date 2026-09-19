import { describe, expect, it } from 'vitest'
import {
  APL,
  apiRequests,
  aplString,
  datasetRef,
  pageViews,
} from '../analytics/apl'

const DS = 'steel-app'

describe('aplString() / datasetRef()', () => {
  it('escapes quotes and backslashes in user values', () => {
    expect(aplString('a"b\\c')).toBe('"a\\"b\\\\c"')
  })

  it('strips anything but safe characters from the dataset name', () => {
    expect(datasetRef("steel-app']|drop")).toBe("['steel-appdrop']")
  })
})

describe('apiRequests()', () => {
  it('reads route-handler events with derived columns and no filters', () => {
    const apl = apiRequests(DS, {})
    expect(apl.split('\n')[0]).toBe("['steel-app']")
    expect(apl).toContain(
      `| where source == "lambda" and isnotnull(['request.statusCode'])`,
    )
    // Campos novos só via column_ifexists (eventos antigos não os têm).
    expect(apl).toContain("column_ifexists('request.route', '')")
    expect(apl).toContain("column_ifexists('request.userId', '')")
    expect(apl).toContain("column_ifexists('request.errorCode', '')")
    // Rota normalizada por regex como reserva, aplicada duas vezes.
    expect(apl.match(/replace_regex\(/g)).toHaveLength(2)
    expect(apl).toContain(`@'/[id]$\{2}'`)
    expect(apl).not.toContain('platform.environment')
    expect(apl).not.toMatch(/where (workspaceId|route|status) /)
  })

  it('applies every filter as an escaped literal', () => {
    const apl = apiRequests(DS, {
      env: 'production',
      workspace: 'k3v9x0q2m1n8b7c6z5a4s3d2',
      route: '/api/workspaces/[id]/crm/leads',
      status: '5xx',
    })
    expect(apl).toContain(`| where ['platform.environment'] == "production"`)
    expect(apl).toContain('| where workspaceId == "k3v9x0q2m1n8b7c6z5a4s3d2"')
    expect(apl).toContain('| where route == "/api/workspaces/[id]/crm/leads"')
    expect(apl).toContain('| where status >= 500 and status < 600')
  })

  it.each([
    ['2xx', 200, 300],
    ['3xx', 300, 400],
    ['4xx', 400, 500],
  ] as const)('maps status class %s', (status, min, max) => {
    expect(apiRequests(DS, { status })).toContain(
      `| where status >= ${min} and status < ${max}`,
    )
  })
})

describe('pageViews()', () => {
  it('reads proxy events without API/_next paths', () => {
    const apl = pageViews(DS, { env: 'development' })
    expect(apl).toContain('| where source == "middleware"')
    expect(apl).toContain(
      '| where not(path startswith "/api/") and not(path startswith "/_next")',
    )
    expect(apl).toContain("column_ifexists('request.country', '')")
    expect(apl).toContain(`== "development"`)
  })

  it('filters by workspace slug, matching nothing without one', () => {
    expect(pageViews(DS, { workspace: 'w1', workspaceSlug: 'acme' })).toContain(
      '| where workspaceSlug == "acme"',
    )
    expect(pageViews(DS, { workspace: 'w1' })).toContain(
      '| where workspaceSlug == ""',
    )
    expect(pageViews(DS, { route: '/[workspace]/crm' })).toContain(
      '| where route == "/[workspace]/crm"',
    )
  })
})

describe('APL queries', () => {
  const filters = { env: 'production' as const }

  it('trafficSeries aggregates per bin with percentiles', () => {
    const apl = APL.trafficSeries(DS, filters, '1m')
    expect(apl).toContain(
      '| summarize requests = count(), errors4xx = countif(status >= 400 and status < 500), errors5xx = countif(status >= 500), p50 = percentile(duration, 50), p95 = percentile(duration, 95), p99 = percentile(duration, 99) by bin(_time, 1m)',
    )
    expect(apl.endsWith('| order by _time asc')).toBe(true)
  })

  it('trafficTotals adds unique users and workspaces', () => {
    expect(APL.trafficTotals(DS, filters)).toContain(
      'users = dcountif(userId, isnotempty(userId)), workspaces = dcountif(workspaceId, isnotempty(workspaceId))',
    )
  })

  it('routeStats groups by route and method', () => {
    const apl = APL.routeStats(DS, filters, 50)
    expect(apl).toContain('by route, method')
    expect(apl).toContain('| take 50')
  })

  it('statusBreakdown counts per status', () => {
    expect(APL.statusBreakdown(DS, filters)).toContain(
      '| summarize count = count() by status',
    )
  })

  it('error queries keep only >= 400', () => {
    for (const apl of [
      APL.errorSamples(DS, filters, 10),
      APL.errorGroups(DS, filters),
      APL.errorTrend(DS, filters, '15m'),
    ]) {
      expect(apl).toContain('| where status >= 400')
    }
    expect(APL.errorSamples(DS, filters, 10)).toContain(
      '| project _time, method, route, status, errorCode, errorMessage, duration',
    )
    expect(APL.errorGroups(DS, filters)).toContain(
      'lastSeen = max(_time) by status, errorCode, route, errorMessage',
    )
  })

  it('activity and unique totals count distinct ids', () => {
    expect(APL.activity(DS, filters, '1h')).toContain('by bin(_time, 1h)')
    expect(APL.uniqueTotals(DS, filters)).toContain('dcountif(userId')
  })

  it('access queries read page views', () => {
    expect(APL.pageViewTotal(DS, filters)).toContain(
      '| summarize pageViews = count()',
    )
    expect(APL.countries(DS, filters)).toContain('by country, countryCode')
    expect(APL.cities(DS, filters)).toContain('by city, country')
    expect(APL.clients(DS, filters)).toContain('by browser, os, device')
  })
})
