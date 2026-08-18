import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmSocialConnection } from '@/src/__tests__/factories/crm-social.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-social.repository')
vi.mock('@/src/lib/social/crypto', () => ({
  isTokenCryptoConfigured: vi.fn(() => true),
  encryptToken: vi.fn((plaintext: string) => `enc:${plaintext}`),
  decryptToken: vi.fn((payload: string) => payload.replace(/^enc:/, '')),
}))

import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import { getFreshAccessToken } from '../crm-social-token'

const mockedConnectionRepo = vi.mocked(CrmSocialConnectionRepository)

describe('getFreshAccessToken()', () => {
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
})
