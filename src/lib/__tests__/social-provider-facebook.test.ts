import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/src/lib/result'

vi.mock('@/src/lib/social/providers/http', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/lib/social/providers/http')>()
  return { ...actual, getJson: vi.fn() }
})

import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { facebookProvider } from '@/src/lib/social/providers/facebook'
import { getJson } from '@/src/lib/social/providers/http'

const mockedGetJson = vi.mocked(getJson)

const tokens = {
  accessToken: 'user-token',
  refreshToken: null,
  expiresAt: null,
  scope: 'pages_show_list',
}

describe('facebookProvider.fetchAccounts', () => {
  it('should return one account per Page with an access_token', async () => {
    mockedGetJson.mockResolvedValue(
      ok({
        data: [
          { id: 'page-1', name: 'Page One', access_token: 'page-token-1' },
          { id: 'page-2', name: 'Page Two', access_token: 'page-token-2' },
        ],
      }),
    )

    const result = expectOk(await facebookProvider.fetchAccounts(tokens))

    expect(result).toHaveLength(2)
    expect(result.map((a) => a.externalId)).toEqual(['page-1', 'page-2'])
    expect(result[0].accessTokenOverride?.accessToken).toBe('page-token-1')
  })

  it('should filter out Pages without an access_token', async () => {
    mockedGetJson.mockResolvedValue(
      ok({
        data: [
          { id: 'page-1', name: 'Page One', access_token: 'page-token-1' },
          { id: 'page-2', name: 'Page Two' },
        ],
      }),
    )

    const result = expectOk(await facebookProvider.fetchAccounts(tokens))

    expect(result).toHaveLength(1)
    expect(result[0].externalId).toBe('page-1')
  })

  it('should return CRM_SOCIAL_NO_PAGE when no Page was granted', async () => {
    mockedGetJson.mockResolvedValue(ok({ data: [] }))

    const result = await facebookProvider.fetchAccounts(tokens)

    expectErr(result, 'CRM_SOCIAL_NO_PAGE')
  })
})
