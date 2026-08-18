import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/src/lib/result'

vi.mock('@/src/lib/social/providers/http', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/lib/social/providers/http')>()
  return { ...actual, getJson: vi.fn() }
})

import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { getJson } from '@/src/lib/social/providers/http'
import { instagramProvider } from '@/src/lib/social/providers/instagram'

const mockedGetJson = vi.mocked(getJson)

const tokens = {
  accessToken: 'user-token',
  refreshToken: null,
  expiresAt: null,
  scope: 'instagram_basic',
}

describe('instagramProvider.fetchAccounts', () => {
  it('should return one account per Page with an IG business account linked', async () => {
    mockedGetJson.mockResolvedValue(
      ok({
        data: [
          {
            id: 'page-1',
            name: 'Page One',
            access_token: 'page-token-1',
            instagram_business_account: { id: 'ig-1', username: 'acme_one' },
          },
          {
            id: 'page-2',
            name: 'Page Two',
            access_token: 'page-token-2',
            instagram_business_account: { id: 'ig-2', username: 'acme_two' },
          },
        ],
      }),
    )

    const result = expectOk(await instagramProvider.fetchAccounts(tokens))

    expect(result).toHaveLength(2)
    expect(result.map((a) => a.externalId)).toEqual(['ig-1', 'ig-2'])
    expect(result[0].name).toBe('@acme_one')
    expect(result[0].accessTokenOverride?.accessToken).toBe('page-token-1')
  })

  it('should filter out Pages without an Instagram business account linked', async () => {
    mockedGetJson.mockResolvedValue(
      ok({
        data: [
          {
            id: 'page-1',
            name: 'Page One',
            access_token: 'page-token-1',
            instagram_business_account: { id: 'ig-1', username: 'acme_one' },
          },
          { id: 'page-2', name: 'Page Two', access_token: 'page-token-2' },
        ],
      }),
    )

    const result = expectOk(await instagramProvider.fetchAccounts(tokens))

    expect(result).toHaveLength(1)
    expect(result[0].externalId).toBe('ig-1')
  })

  it('should return CRM_SOCIAL_IG_NOT_LINKED when no Page has an IG account linked', async () => {
    mockedGetJson.mockResolvedValue(
      ok({
        data: [
          { id: 'page-1', name: 'Page One', access_token: 'page-token-1' },
        ],
      }),
    )

    const result = await instagramProvider.fetchAccounts(tokens)

    expectErr(result, 'CRM_SOCIAL_IG_NOT_LINKED')
  })
})
