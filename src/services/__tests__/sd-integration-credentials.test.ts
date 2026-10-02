import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdGithubIntegration,
  createFakeSdIntegration,
} from '@/src/__tests__/factories/sd-integration.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(),
  decryptConnectionSecret: vi.fn(),
}))

import { decryptConnectionSecret } from '@/src/lib/crypto'
import {
  decryptSdIntegrationSecret,
  decryptSdIntegrationToken,
} from '../sd-integration-credentials'

const decrypt = vi.mocked(decryptConnectionSecret)

beforeEach(() => {
  decrypt.mockImplementation(async (value: string) =>
    value.replace(/^enc:/, ''),
  )
})

describe('decryptSdIntegrationToken', () => {
  it('decifra o token do envelope', async () => {
    const token = expectOk(
      await decryptSdIntegrationToken(createFakeSdIntegration()),
    )
    expect(token).toBe('xoxb-token')
  })

  it('recusa integração sem token (desconectada)', async () => {
    expectErr(
      await decryptSdIntegrationToken(
        createFakeSdIntegration({ encryptedToken: '' }),
      ),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    expect(decrypt).not.toHaveBeenCalled()
  })

  it('recusa envelope que decifra para vazio', async () => {
    decrypt.mockResolvedValue('')
    expectErr(
      await decryptSdIntegrationToken(createFakeSdIntegration()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('chave trocada ou envelope corrompido não lança', async () => {
    decrypt.mockRejectedValue(new Error('bad key'))
    const error = expectErr(
      await decryptSdIntegrationToken(createFakeSdIntegration()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    expect(error.message).toContain('credenciais')
  })
})

describe('decryptSdIntegrationSecret', () => {
  it('decifra o segredo do webhook', async () => {
    expect(
      expectOk(
        await decryptSdIntegrationSecret(createFakeSdGithubIntegration()),
      ),
    ).toBe('hook-secret')
  })

  it('devolve null quando não há segredo guardado', async () => {
    expect(
      expectOk(
        await decryptSdIntegrationSecret(
          createFakeSdGithubIntegration({ encryptedSigningSecret: null }),
        ),
      ),
    ).toBeNull()
  })

  it('envelope corrompido não lança', async () => {
    decrypt.mockRejectedValue(new Error('bad key'))
    const error = expectErr(
      await decryptSdIntegrationSecret(createFakeSdGithubIntegration()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    expect(error.message).toContain('segredo do webhook')
  })
})
