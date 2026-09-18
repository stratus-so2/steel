import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  asMember,
  describeSocialAuthz,
  withToken,
} from '@/src/__tests__/helpers/crm-social.helpers'
import {
  type FetchCall,
  headerOf,
  jsonResponse,
  mockFetch,
  textResponse,
  unreadableResponse,
} from '@/src/__tests__/helpers/fetch.helpers'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

const env = vi.hoisted(() => ({
  developerToken: 'dev-token' as string | undefined,
}))

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/services/crm-social-token')
vi.mock('@/lib/env/server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/env/server')>()
  return {
    ...original,
    get GOOGLE_ADS_DEVELOPER_TOKEN() {
      return env.developerToken
    },
  }
})

import { getInsights, getOverview } from '../crm-social-google-ads.service'

const BASE = 'https://googleads.googleapis.com/v23'
const NOW = new Date('2026-09-18T12:00:00.000Z')

let fetchMock: ReturnType<typeof mockFetch>

function queryOf(call: FetchCall): string {
  return JSON.parse(String(call.init?.body)).query
}

/** Roteia as buscas GAQL pelo `FROM`/`SELECT` da query. */
function gaql(handlers: {
  totals?: () => Response
  name?: () => Response
  campaigns?: () => Response
  series?: () => Response
}) {
  return mockFetch((_url, init) => {
    const query: string = JSON.parse(String(init?.body)).query
    if (query.includes('customer.descriptive_name')) {
      return handlers.name?.() ?? jsonResponse({ results: [] })
    }
    if (query.includes('FROM customer')) {
      return handlers.totals?.() ?? jsonResponse({ results: [] })
    }
    if (query.includes('campaign.status')) {
      return handlers.campaigns?.() ?? jsonResponse({ results: [] })
    }
    return handlers.series?.() ?? jsonResponse({ results: [] })
  })
}

beforeEach(() => {
  env.developerToken = 'dev-token'
  fetchMock = mockFetch(() => {
    throw new Error('unexpected fetch')
  })
  asMember('MEMBER')
  withToken(
    {
      scope: 'https://www.googleapis.com/auth/adwords',
      externalAccountId: '1234567890',
    },
    'ads-token',
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
      scope: 'adwords',
      externalAccountId: '1234567890',
      call: () => getOverview('u1', 'ws1'),
    },
    {
      name: 'getInsights()',
      action: 'VIEW',
      scope: 'adwords',
      externalAccountId: '1234567890',
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

  it('should combine 30d totals, account identity and active campaigns', async () => {
    fetchMock = gaql({
      totals: () =>
        jsonResponse({
          results: [
            {
              metrics: {
                impressions: '1000',
                clicks: '50',
                costMicros: '2500000',
                conversions: '3.5',
                ctr: '0.05',
              },
            },
          ],
        }),
      name: () =>
        jsonResponse({
          results: [
            {
              customer: {
                id: '1234567890',
                descriptiveName: 'Acme Ads',
                currencyCode: 'USD',
              },
            },
          ],
        }),
      campaigns: () =>
        jsonResponse({ results: [{ campaign: { id: '1' } }, {}] }),
    })

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      customerId: '1234567890',
      customerName: 'Acme Ads',
      currency: 'USD',
      totals: {
        impressions: 1000,
        clicks: 50,
        costMicros: 2_500_000,
        conversions: 3.5,
        ctr: 0.05,
      },
      activeCampaigns: 2,
    })

    const calls = fetchMock.calls()
    expect(calls).toHaveLength(3)
    for (const call of calls) {
      expect(call.url).toBe(`${BASE}/customers/1234567890/googleAds:search`)
      expect(call.init?.method).toBe('POST')
      expect(headerOf(call, 'Authorization')).toBe('Bearer ads-token')
      expect(headerOf(call, 'developer-token')).toBe('dev-token')
      expect(headerOf(call, 'login-customer-id')).toBeNull()
    }
    const totalsQuery = calls.map(queryOf).find((q) => q.includes('ctr'))
    expect(totalsQuery).toContain("BETWEEN '2026-08-19' AND '2026-09-17'")
  })

  it('should query the sub-account through its manager (login-customer-id)', async () => {
    withToken({ scope: 'adwords', externalAccountId: '999|555' }, 'ads-token')
    fetchMock = gaql({})

    const overview = expectOk(await getOverview('u1', 'ws1'))

    expect(overview.customerId).toBe('999|555')
    for (const call of fetchMock.calls()) {
      expect(call.url).toBe(`${BASE}/customers/555/googleAds:search`)
      expect(headerOf(call, 'login-customer-id')).toBe('999')
    }
  })

  it('should default the name/currency/totals and count 0 campaigns when empty', async () => {
    fetchMock = gaql({
      totals: () => jsonResponse({}),
      name: () => jsonResponse({}),
      campaigns: () => jsonResponse({}),
    })

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      customerId: '1234567890',
      customerName: null,
      currency: 'BRL',
      totals: {
        impressions: 0,
        clicks: 0,
        costMicros: 0,
        conversions: 0,
        ctr: 0,
      },
      activeCampaigns: 0,
    })
  })

  it('should still answer with 0 active campaigns when that query fails', async () => {
    fetchMock = gaql({
      campaigns: () => textResponse('PERMISSION_DENIED', { status: 403 }),
    })
    expect(expectOk(await getOverview('u1', 'ws1')).activeCampaigns).toBe(0)
  })

  it('should send an empty developer-token when it is not configured', async () => {
    env.developerToken = undefined
    fetchMock = gaql({})

    expectOk(await getOverview('u1', 'ws1'))
    expect(headerOf(fetchMock.calls()[0], 'developer-token')).toBe('')
  })

  it.each([
    ['totals', { totals: () => textResponse('bad', { status: 400 }) }],
    ['identity', { name: () => unreadableResponse({ status: 500 }) }],
  ])('should fail when the %s query fails', async (_, handlers) => {
    fetchMock = gaql(handlers)
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should map a network error', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it.each([
    ['unknown', 'unknown'],
    ['empty', ''],
    ['a manager without sub-accounts', '999|'],
  ])('should return CRM_SOCIAL_CONNECTION_NOT_FOUND for %s account id', async (_, externalAccountId) => {
    withToken({ scope: 'adwords', externalAccountId })
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_CONNECTION_NOT_FOUND')
    expectErr(
      await getInsights('u1', 'ws1', '7d'),
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

  it('should aggregate campaign rows per day and total them', async () => {
    fetchMock = gaql({
      series: () =>
        jsonResponse({
          results: [
            {
              segments: { date: '2026-09-02' },
              metrics: {
                impressions: '10',
                clicks: '1',
                costMicros: '100',
                conversions: '0.5',
              },
            },
            {
              segments: { date: '2026-09-01' },
              metrics: { impressions: '5', clicks: '2', costMicros: '50' },
            },
            {
              segments: { date: '2026-09-02' },
              metrics: {
                impressions: '20',
                clicks: 'x',
                costMicros: '300',
                conversions: '1',
              },
            },
            { segments: {}, metrics: { impressions: '999' } },
            { segments: { date: '2026-09-03' } },
          ],
        }),
    })

    expect(expectOk(await getInsights('u1', 'ws1', '30d'))).toEqual({
      range: '30d',
      startDate: '2026-08-19',
      endDate: '2026-09-17',
      totals: { impressions: 35, clicks: 3, costMicros: 450, conversions: 1.5 },
      series: [
        {
          date: '2026-09-01',
          impressions: 5,
          clicks: 2,
          costMicros: 50,
          conversions: 0,
        },
        {
          date: '2026-09-02',
          impressions: 30,
          clicks: 1,
          costMicros: 400,
          conversions: 1.5,
        },
        {
          date: '2026-09-03',
          impressions: 0,
          clicks: 0,
          costMicros: 0,
          conversions: 0,
        },
      ],
    })
    const query = queryOf(fetchMock.calls()[0])
    expect(query).toContain('FROM campaign')
    expect(query).toContain("BETWEEN '2026-08-19' AND '2026-09-17'")
    expect(query).toContain('ORDER BY segments.date ASC')
  })

  it('should return an empty series when there are no results', async () => {
    fetchMock = gaql({ series: () => jsonResponse({}) })
    const insights = expectOk(await getInsights('u1', 'ws1', '7d'))
    expect(insights.startDate).toBe('2026-09-11')
    expect(insights.series).toEqual([])
  })

  it('should propagate a 401 from the Ads API', async () => {
    fetchMock = gaql({ series: () => textResponse('', { status: 401 }) })
    expectErr(await getInsights('u1', 'ws1', '7d'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})
