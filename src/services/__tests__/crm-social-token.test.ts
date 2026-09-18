import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmSocialConnection } from '@/src/__tests__/factories/crm-social.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { crmSocialOauthFailed, databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-social.repository')
vi.mock('@/src/lib/social/crypto', () => ({
  isTokenCryptoConfigured: vi.fn(() => true),
  encryptToken: vi.fn((plaintext: string) => `enc:${plaintext}`),
  decryptToken: vi.fn((payload: string) => payload.replace(/^enc:/, '')),
}))
vi.mock('@/src/lib/social/providers', () => ({
  getProvider: vi.fn(),
}))

import { isTokenCryptoConfigured } from '@/src/lib/social/crypto'
import { getProvider } from '@/src/lib/social/providers'
import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import { getFreshAccessToken } from '../crm-social-token'

const mockedConnectionRepo = vi.mocked(CrmSocialConnectionRepository)
const mockedGetProvider = vi.mocked(getProvider)
const NOW = new Date('2026-09-18T12:00:00.000Z')

type Provider = ReturnType<typeof getProvider>

function provider(refreshAccessToken?: Provider['refreshAccessToken']) {
  return {
    platform: 'YOUTUBE',
    isConfigured: () => true,
    buildAuthorizeUrl: () => '',
    exchangeCode: vi.fn(),
    fetchAccounts: vi.fn(),
    refreshAccessToken,
  } as unknown as Provider
}

describe('getFreshAccessToken()', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should resolve by connectionId via findById when provided', async () => {
    const connection = createFakeCrmSocialConnection({
      id: 'conn1',
      accessToken: 'enc:token',
      tokenExpiresAt: null,
    })
    mockedConnectionRepo.findById.mockResolvedValue(ok(connection))

    const result = expectOk(
      await getFreshAccessToken('ws1', 'FACEBOOK', 'conn1'),
    )

    expect(result.accessToken).toBe('token')
    expect(mockedConnectionRepo.findById).toHaveBeenCalledWith('conn1', 'ws1')
    expect(mockedConnectionRepo.findPrimaryByPlatform).not.toHaveBeenCalled()
  })

  it('should resolve the primary connection via findPrimaryByPlatform when connectionId is omitted', async () => {
    const connection = createFakeCrmSocialConnection({
      id: 'conn1',
      accessToken: 'enc:token',
      tokenExpiresAt: null,
      isPrimary: true,
    })
    mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(ok(connection))

    const result = expectOk(await getFreshAccessToken('ws1', 'FACEBOOK'))

    expect(result.accessToken).toBe('token')
    expect(mockedConnectionRepo.findPrimaryByPlatform).toHaveBeenCalledWith(
      'ws1',
      'FACEBOOK',
    )
    expect(mockedConnectionRepo.findById).not.toHaveBeenCalled()
  })

  it('should refuse when token encryption is not configured', async () => {
    vi.mocked(isTokenCryptoConfigured).mockReturnValueOnce(false)

    expectErr(
      await getFreshAccessToken('ws1', 'FACEBOOK'),
      'CRM_SOCIAL_CONNECTION_NOT_FOUND',
    )
    expect(mockedConnectionRepo.findPrimaryByPlatform).not.toHaveBeenCalled()
  })

  it('should propagate a repository error', async () => {
    mockedConnectionRepo.findById.mockResolvedValue(err(databaseError('boom')))
    expectErr(
      await getFreshAccessToken('ws1', 'FACEBOOK', 'c1'),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['there is no primary connection', null],
    [
      'the connection has no access token',
      createFakeCrmSocialConnection({ accessToken: null }),
    ],
    [
      'the connection is EXPIRED',
      createFakeCrmSocialConnection({
        accessToken: 'enc:t',
        status: 'EXPIRED',
      }),
    ],
  ])('should return CRM_SOCIAL_CONNECTION_NOT_FOUND when %s', async (_, connection) => {
    mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(ok(connection))
    expectErr(
      await getFreshAccessToken('ws1', 'INSTAGRAM'),
      'CRM_SOCIAL_CONNECTION_NOT_FOUND',
    )
  })

  it('should use the current token while it is outside the 5 min margin', async () => {
    mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(
      ok(
        createFakeCrmSocialConnection({
          accessToken: 'enc:current',
          tokenExpiresAt: new Date(NOW.getTime() + 6 * 60_000),
        }),
      ),
    )

    expect(
      expectOk(await getFreshAccessToken('ws1', 'YOUTUBE')).accessToken,
    ).toBe('current')
    expect(mockedGetProvider).not.toHaveBeenCalled()
  })

  describe('near expiry', () => {
    const expiring = (overrides = {}) =>
      createFakeCrmSocialConnection({
        id: 'conn1',
        accessToken: 'enc:old',
        refreshToken: 'enc:refresh',
        scope: 'old-scope',
        tokenExpiresAt: new Date(NOW.getTime() + 4 * 60_000),
        ...overrides,
      })

    it('should mark the connection EXPIRED when there is no refresh token', async () => {
      mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(
        ok(expiring({ refreshToken: null })),
      )
      mockedGetProvider.mockReturnValue(provider(vi.fn()))

      expectErr(
        await getFreshAccessToken('ws1', 'YOUTUBE'),
        'CRM_SOCIAL_CONNECTION_NOT_FOUND',
      )
      expect(mockedConnectionRepo.setStatus).toHaveBeenCalledWith(
        'conn1',
        'EXPIRED',
      )
    })

    it('should mark the connection EXPIRED when the provider cannot refresh', async () => {
      mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(
        ok(expiring()),
      )
      mockedGetProvider.mockReturnValue(provider(undefined))

      expectErr(
        await getFreshAccessToken('ws1', 'FACEBOOK'),
        'CRM_SOCIAL_CONNECTION_NOT_FOUND',
      )
      expect(mockedConnectionRepo.setStatus).toHaveBeenCalledWith(
        'conn1',
        'EXPIRED',
      )
    })

    it('should mark EXPIRED and propagate when the refresh fails', async () => {
      mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(
        ok(expiring({ tokenExpiresAt: new Date(NOW.getTime() - 1000) })),
      )
      const refresh = vi.fn(async () => err(crmSocialOauthFailed('revoked')))
      mockedGetProvider.mockReturnValue(provider(refresh))

      const error = expectErr(
        await getFreshAccessToken('ws1', 'YOUTUBE'),
        'CRM_SOCIAL_OAUTH_FAILED',
      )
      expect(error.message).toBe('revoked')
      expect(refresh).toHaveBeenCalledWith('refresh')
      expect(mockedConnectionRepo.setStatus).toHaveBeenCalledWith(
        'conn1',
        'EXPIRED',
      )
      expect(mockedConnectionRepo.updateTokens).not.toHaveBeenCalled()
    })

    it('should persist the rotated tokens (encrypted) and return the new access token', async () => {
      mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(
        ok(expiring()),
      )
      const expiresAt = new Date(NOW.getTime() + 3_600_000)
      mockedGetProvider.mockReturnValue(
        provider(
          vi.fn(async () =>
            ok({
              accessToken: 'new-access',
              refreshToken: 'new-refresh',
              expiresAt,
              scope: 'new-scope',
            }),
          ),
        ),
      )
      const updated = expiring({ accessToken: 'enc:new-access' })
      mockedConnectionRepo.updateTokens.mockResolvedValue(ok(updated))

      const result = expectOk(await getFreshAccessToken('ws1', 'YOUTUBE'))

      expect(result).toEqual({ accessToken: 'new-access', connection: updated })
      expect(mockedConnectionRepo.updateTokens).toHaveBeenCalledWith('conn1', {
        accessToken: 'enc:new-access',
        refreshToken: 'enc:new-refresh',
        tokenExpiresAt: expiresAt,
        scope: 'new-scope',
      })
      expect(mockedConnectionRepo.setStatus).not.toHaveBeenCalled()
    })

    it('should keep the previous refresh token and scope when the provider omits them', async () => {
      mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(
        ok(expiring()),
      )
      mockedGetProvider.mockReturnValue(
        provider(
          vi.fn(async () =>
            ok({
              accessToken: 'new-access',
              refreshToken: null,
              expiresAt: null,
              scope: null,
            }),
          ),
        ),
      )
      mockedConnectionRepo.updateTokens.mockResolvedValue(ok(expiring()))

      expectOk(await getFreshAccessToken('ws1', 'YOUTUBE'))

      expect(mockedConnectionRepo.updateTokens).toHaveBeenCalledWith('conn1', {
        accessToken: 'enc:new-access',
        refreshToken: 'enc:refresh',
        tokenExpiresAt: null,
        scope: 'old-scope',
      })
    })

    it('should propagate a failure persisting the rotated tokens', async () => {
      mockedConnectionRepo.findPrimaryByPlatform.mockResolvedValue(
        ok(expiring()),
      )
      mockedGetProvider.mockReturnValue(
        provider(
          vi.fn(async () =>
            ok({
              accessToken: 'a',
              refreshToken: null,
              expiresAt: null,
              scope: null,
            }),
          ),
        ),
      )
      mockedConnectionRepo.updateTokens.mockResolvedValue(
        err(databaseError('write failed')),
      )

      expectErr(await getFreshAccessToken('ws1', 'YOUTUBE'), 'DATABASE_ERROR')
    })
  })
})
