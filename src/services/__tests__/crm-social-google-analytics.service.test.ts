import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  asMember,
  describeSocialAuthz,
  withToken,
} from '@/src/__tests__/helpers/crm-social.helpers'
import {
  headerOf,
  jsonResponse,
  mockFetch,
  textResponse,
} from '@/src/__tests__/helpers/fetch.helpers'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/services/crm-social-token')

import {
  getInsights,
  getOverview,
} from '../crm-social-google-analytics.service'

const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'
const PROPERTY = 'properties/123'
const NOW = new Date('2026-09-18T12:00:00.000Z')

let fetchMock: ReturnType<typeof mockFetch>

beforeEach(() => {
  fetchMock = mockFetch(() => {
    throw new Error('unexpected fetch')
  })
  asMember('VIEWER')
  withToken(
    {
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      externalAccountId: PROPERTY,
    },
    'ga-token',
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describeSocialAuthz(
  [
    {
      name: 'getOverview()',
      action: 'VIEW',
      scope: 'analytics.readonly',
      externalAccountId: PROPERTY,
      call: () => getOverview('u1', 'ws1'),
    },
    {
      name: 'getInsights()',
      action: 'VIEW',
      scope: 'analytics.readonly',
      externalAccountId: PROPERTY,
      call: () => getInsights('u1', 'ws1', '7d'),
    },
  ],
  () => fetchMock.spy,
)

describe('getOverview()', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  function route(overrides: {
    property?: () => Response
    account?: () => Response
    report?: () => Response
  }) {
    return mockFetch((url) => {
      if (url === `${ADMIN_API}/${PROPERTY}`) {
        return (
          overrides.property?.() ??
          jsonResponse({ displayName: 'Site Acme', account: 'accounts/9' })
        )
      }
      if (url === `${ADMIN_API}/accounts/9`) {
        return overrides.account?.() ?? jsonResponse({ displayName: 'Acme' })
      }
      if (url === `${DATA_API}/${PROPERTY}:runReport`) {
        return (
          overrides.report?.() ??
          jsonResponse({
            totals: [
              {
                metricValues: [
                  { value: '120' },
                  { value: '150' },
                  { value: '400' },
                  { value: '999' },
                ],
              },
            ],
          })
        )
      }
      throw new Error(`unexpected ${url}`)
    })
  }

  it('should combine the property identity with the 28d totals', async () => {
    fetchMock = route({})

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      propertyId: PROPERTY,
      propertyName: 'Site Acme',
      accountName: 'Acme',
      totals: {
        activeUsers: 120,
        sessions: 150,
        screenPageViews: 400,
        eventCount: 999,
      },
    })
    const calls = fetchMock.calls()
    for (const call of calls) {
      expect(headerOf(call, 'Authorization')).toBe('Bearer ga-token')
    }
    const report = calls[2]
    expect(report.init?.method).toBe('POST')
    expect(JSON.parse(String(report.init?.body))).toEqual({
      dateRanges: [{ startDate: '2026-08-21', endDate: '2026-09-17' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'eventCount' },
      ],
    })
  })

  it('should skip the account lookup when the property has no parent', async () => {
    fetchMock = route({ property: () => jsonResponse({}) })

    const overview = expectOk(await getOverview('u1', 'ws1'))
    expect(overview.propertyName).toBe('Propriedade')
    expect(overview.accountName).toBeNull()
    expect(fetchMock.calls()).toHaveLength(2)
  })

  it.each([
    ['fails', () => textResponse('', { status: 403 })],
    ['has no display name', () => jsonResponse({})],
  ])('should keep a null account name when the account lookup %s', async (_, account) => {
    fetchMock = route({ account })
    expect(expectOk(await getOverview('u1', 'ws1')).accountName).toBeNull()
  })

  it('should zero the totals when the report has none', async () => {
    fetchMock = route({ report: () => jsonResponse({}) })
    expect(expectOk(await getOverview('u1', 'ws1')).totals).toEqual({
      activeUsers: 0,
      sessions: 0,
      screenPageViews: 0,
      eventCount: 0,
    })
  })

  it('should fail when the property lookup fails', async () => {
    fetchMock = route({
      property: () =>
        jsonResponse(
          { error: { message: 'User does not have sufficient permissions' } },
          { status: 403 },
        ),
    })
    const error = expectErr(
      await getOverview('u1', 'ws1'),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(error.message).toBe('User does not have sufficient permissions')
  })

  it('should fail when the report fails', async () => {
    fetchMock = route({ report: () => textResponse('quota', { status: 429 }) })
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it.each([
    ['unknown', 'unknown'],
    ['empty', ''],
  ])('should return CRM_SOCIAL_CONNECTION_NOT_FOUND for an %s property', async (_, externalAccountId) => {
    withToken({ scope: 'analytics.readonly', externalAccountId })
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_CONNECTION_NOT_FOUND')
    expectErr(
      await getInsights('u1', 'ws1', '28d'),
      'CRM_SOCIAL_CONNECTION_NOT_FOUND',
    )
    expect(fetchMock.spy).not.toHaveBeenCalled()
  })
})

describe('getInsights()', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  it('should request a daily report and map YYYYMMDD rows', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        rows: [
          {
            dimensionValues: [{ value: '20260910' }],
            metricValues: [{ value: '10' }, { value: '12' }, { value: '30' }],
          },
          {
            dimensionValues: [{ value: '(other)' }],
            metricValues: [{ value: 'x' }],
          },
          {},
        ],
        totals: [
          {
            metricValues: [
              { value: '10' },
              { value: '12' },
              { value: '30' },
              { value: '44' },
            ],
          },
        ],
      }),
    )

    expect(expectOk(await getInsights('u1', 'ws1', '7d'))).toEqual({
      range: '7d',
      startDate: '2026-09-11',
      endDate: '2026-09-17',
      totals: {
        activeUsers: 10,
        sessions: 12,
        screenPageViews: 30,
        eventCount: 44,
      },
      series: [
        {
          date: '2026-09-10',
          activeUsers: 10,
          sessions: 12,
          screenPageViews: 30,
        },
        { date: '(other)', activeUsers: 0, sessions: 0, screenPageViews: 0 },
        { date: '', activeUsers: 0, sessions: 0, screenPageViews: 0 },
      ],
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe(`${DATA_API}/${PROPERTY}:runReport`)
    const body = JSON.parse(String(call.init?.body))
    expect(body.dimensions).toEqual([{ name: 'date' }])
    expect(body.orderBys).toEqual([{ dimension: { dimensionName: 'date' } }])
    expect(body.dateRanges).toEqual([
      { startDate: '2026-09-11', endDate: '2026-09-17' },
    ])
  })

  it('should return an empty series and zero totals for an empty report', async () => {
    fetchMock = mockFetch(() => jsonResponse({}))
    const insights = expectOk(await getInsights('u1', 'ws1', '28d'))
    expect(insights.startDate).toBe('2026-08-21')
    expect(insights.series).toEqual([])
    expect(insights.totals.eventCount).toBe(0)
  })

  it('should propagate a report failure', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(await getInsights('u1', 'ws1', '7d'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})
