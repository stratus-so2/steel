import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/two-factor.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditAuth: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
// O serviço importa `auth` só para as duas verificações padrão, que todo
// teste aqui substitui por `verifiers`. Mockar o módulo evita subir o
// better-auth (que exige env, Prisma e Redis) num teste unitário.
vi.mock('@/src/lib/auth', () => ({
  auth: { api: { verifyTOTP: vi.fn(), verifyPassword: vi.fn() } },
}))

import { auditAuth } from '@/lib/axiom/audit'
import { TwoFactorRepository } from '@/src/repositories/two-factor.repository'
import {
  TwoFactorService,
  type TwoFactorVerifiers,
} from '../two-factor.service'

const repo = vi.mocked(TwoFactorRepository)
const audit = vi.mocked(auditAuth)

const headers = new Headers({ cookie: 'better-auth.session_token=abc' })

function verifiers(
  overrides: Partial<TwoFactorVerifiers> = {},
): TwoFactorVerifiers {
  return {
    verifyTotpCode: vi.fn(async () => true),
    verifyPassword: vi.fn(async () => true),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TwoFactorService.status()', () => {
  it('reports the plugin switch, the app flag and whether a secret exists', async () => {
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: true }),
    )
    repo.hasSecret.mockResolvedValue(ok(true))

    expect(expectOk(await TwoFactorService.status('u1'))).toEqual({
      twoFactorEnabled: true,
      totpEnabled: true,
      hasSecret: true,
    })
    expect(repo.findStatus).toHaveBeenCalledWith('u1')
    expect(repo.hasSecret).toHaveBeenCalledWith('u1')
  })

  it('fails with RESOURCE_NOT_FOUND when the user is gone', async () => {
    repo.findStatus.mockResolvedValue(ok(null))

    expect(expectErr(await TwoFactorService.status('u1')).code).toBe(
      'RESOURCE_NOT_FOUND',
    )
    expect(repo.hasSecret).not.toHaveBeenCalled()
  })

  it('propagates a database error from the status read', async () => {
    repo.findStatus.mockResolvedValue(err(databaseError('boom')))

    expect(expectErr(await TwoFactorService.status('u1')).code).toBe(
      'DATABASE_ERROR',
    )
  })

  it('propagates a database error from the secret read', async () => {
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: false }),
    )
    repo.hasSecret.mockResolvedValue(err(databaseError('boom')))

    expect(expectErr(await TwoFactorService.status('u1')).code).toBe(
      'DATABASE_ERROR',
    )
  })
})

describe('TwoFactorService.confirmTotp()', () => {
  it('turns the app flag on only after the code is accepted', async () => {
    repo.hasSecret.mockResolvedValue(ok(true))
    repo.setTotpEnabled.mockResolvedValue(ok(undefined))
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: true }),
    )
    const v = verifiers()

    const value = expectOk(
      await TwoFactorService.confirmTotp('u1', '123456', headers, v),
    )

    expect(value.totpEnabled).toBe(true)
    expect(v.verifyTotpCode).toHaveBeenCalledWith('123456', headers)
    expect(repo.setTotpEnabled).toHaveBeenCalledWith('u1', true)
    expect(audit).toHaveBeenCalledWith({
      event: 'auth.2fa_totp.enabled',
      userId: 'u1',
    })
  })

  it('refuses with TOTP_NOT_ENABLED when the account has no secret yet', async () => {
    repo.hasSecret.mockResolvedValue(ok(false))
    const v = verifiers()

    expect(
      expectErr(await TwoFactorService.confirmTotp('u1', '123456', headers, v))
        .code,
    ).toBe('TOTP_NOT_ENABLED')
    expect(v.verifyTotpCode).not.toHaveBeenCalled()
    expect(repo.setTotpEnabled).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith({
      event: 'auth.2fa_totp.confirm_failed',
      userId: 'u1',
      outcome: 'failure',
      reason: 'TOTP_NOT_ENABLED',
    })
  })

  it('refuses a wrong code and never writes the flag', async () => {
    repo.hasSecret.mockResolvedValue(ok(true))
    const v = verifiers({ verifyTotpCode: vi.fn(async () => false) })

    expect(
      expectErr(await TwoFactorService.confirmTotp('u1', '000000', headers, v))
        .code,
    ).toBe('TOTP_INVALID_CODE')
    expect(repo.setTotpEnabled).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith({
      event: 'auth.2fa_totp.confirm_failed',
      userId: 'u1',
      outcome: 'failure',
      reason: 'TOTP_INVALID_CODE',
    })
  })

  it('propagates a database error from the secret lookup', async () => {
    repo.hasSecret.mockResolvedValue(err(databaseError('boom')))

    expect(
      expectErr(
        await TwoFactorService.confirmTotp(
          'u1',
          '123456',
          headers,
          verifiers(),
        ),
      ).code,
    ).toBe('DATABASE_ERROR')
    expect(audit).not.toHaveBeenCalled()
  })

  it('propagates a database error from the flag write', async () => {
    repo.hasSecret.mockResolvedValue(ok(true))
    repo.setTotpEnabled.mockResolvedValue(err(databaseError('boom')))

    expect(
      expectErr(
        await TwoFactorService.confirmTotp(
          'u1',
          '123456',
          headers,
          verifiers(),
        ),
      ).code,
    ).toBe('DATABASE_ERROR')
    expect(audit).not.toHaveBeenCalledWith({
      event: 'auth.2fa_totp.enabled',
      userId: 'u1',
    })
  })
})

describe('TwoFactorService.disableTotp()', () => {
  it('turns the app off once the password checks out', async () => {
    repo.findStatus
      .mockResolvedValueOnce(ok({ twoFactorEnabled: true, totpEnabled: true }))
      .mockResolvedValueOnce(ok({ twoFactorEnabled: true, totpEnabled: false }))
    repo.setTotpEnabled.mockResolvedValue(ok(undefined))
    repo.hasSecret.mockResolvedValue(ok(true))
    const v = verifiers()

    const value = expectOk(
      await TwoFactorService.disableTotp('u1', 'senha', headers, v),
    )

    expect(value.totpEnabled).toBe(false)
    // O OTP por e-mail continua de pé: desligar o app não derruba a 2FA.
    expect(value.twoFactorEnabled).toBe(true)
    expect(v.verifyPassword).toHaveBeenCalledWith('senha', headers)
    expect(repo.setTotpEnabled).toHaveBeenCalledWith('u1', false)
    expect(audit).toHaveBeenCalledWith({
      event: 'auth.2fa_totp.disabled',
      userId: 'u1',
    })
  })

  it('refuses a wrong password and leaves the flag alone', async () => {
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: true }),
    )
    const v = verifiers({ verifyPassword: vi.fn(async () => false) })

    expect(
      expectErr(await TwoFactorService.disableTotp('u1', 'errada', headers, v))
        .code,
    ).toBe('INVALID_CREDENTIALS')
    expect(repo.setTotpEnabled).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith({
      event: 'auth.2fa_totp.disabled',
      userId: 'u1',
      outcome: 'failure',
      reason: 'INVALID_PASSWORD',
    })
  })

  it('refuses with TOTP_NOT_ENABLED when no app is enrolled', async () => {
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: false }),
    )
    const v = verifiers()

    expect(
      expectErr(await TwoFactorService.disableTotp('u1', 'senha', headers, v))
        .code,
    ).toBe('TOTP_NOT_ENABLED')
    expect(v.verifyPassword).not.toHaveBeenCalled()
  })

  it('fails with RESOURCE_NOT_FOUND when the user is gone', async () => {
    repo.findStatus.mockResolvedValue(ok(null))

    expect(
      expectErr(
        await TwoFactorService.disableTotp('u1', 'senha', headers, verifiers()),
      ).code,
    ).toBe('RESOURCE_NOT_FOUND')
  })

  it('propagates a database error from the status read', async () => {
    repo.findStatus.mockResolvedValue(err(databaseError('boom')))

    expect(
      expectErr(
        await TwoFactorService.disableTotp('u1', 'senha', headers, verifiers()),
      ).code,
    ).toBe('DATABASE_ERROR')
  })

  it('propagates a database error from the flag write', async () => {
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: true }),
    )
    repo.setTotpEnabled.mockResolvedValue(err(databaseError('boom')))

    expect(
      expectErr(
        await TwoFactorService.disableTotp('u1', 'senha', headers, verifiers()),
      ).code,
    ).toBe('DATABASE_ERROR')
  })
})

describe('TwoFactorService default verifiers', () => {
  it('accept a code the better-auth endpoint accepts', async () => {
    const { auth } = await import('@/src/lib/auth')
    vi.mocked(auth.api.verifyTOTP).mockResolvedValue({} as never)
    repo.hasSecret.mockResolvedValue(ok(true))
    repo.setTotpEnabled.mockResolvedValue(ok(undefined))
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: true }),
    )

    expectOk(await TwoFactorService.confirmTotp('u1', '123456', headers))

    expect(auth.api.verifyTOTP).toHaveBeenCalledWith({
      body: { code: '123456' },
      headers,
    })
  })

  it('treat a throwing better-auth verifyTOTP as an invalid code', async () => {
    const { auth } = await import('@/src/lib/auth')
    vi.mocked(auth.api.verifyTOTP).mockRejectedValue(new Error('invalid'))
    repo.hasSecret.mockResolvedValue(ok(true))

    expect(
      expectErr(await TwoFactorService.confirmTotp('u1', '000000', headers))
        .code,
    ).toBe('TOTP_INVALID_CODE')
  })

  it('accept a password the better-auth endpoint confirms', async () => {
    const { auth } = await import('@/src/lib/auth')
    vi.mocked(auth.api.verifyPassword).mockResolvedValue({
      status: true,
    } as never)
    repo.findStatus
      .mockResolvedValueOnce(ok({ twoFactorEnabled: true, totpEnabled: true }))
      .mockResolvedValueOnce(ok({ twoFactorEnabled: true, totpEnabled: false }))
    repo.setTotpEnabled.mockResolvedValue(ok(undefined))
    repo.hasSecret.mockResolvedValue(ok(true))

    expectOk(await TwoFactorService.disableTotp('u1', 'senha', headers))

    expect(auth.api.verifyPassword).toHaveBeenCalledWith({
      body: { password: 'senha' },
      headers,
    })
  })

  it('treat a non-true verifyPassword result as a wrong password', async () => {
    const { auth } = await import('@/src/lib/auth')
    vi.mocked(auth.api.verifyPassword).mockResolvedValue(null as never)
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: true }),
    )

    expect(
      expectErr(await TwoFactorService.disableTotp('u1', 'senha', headers))
        .code,
    ).toBe('INVALID_CREDENTIALS')
  })

  it('treat a throwing better-auth verifyPassword as a wrong password', async () => {
    const { auth } = await import('@/src/lib/auth')
    vi.mocked(auth.api.verifyPassword).mockRejectedValue(new Error('nope'))
    repo.findStatus.mockResolvedValue(
      ok({ twoFactorEnabled: true, totpEnabled: true }),
    )

    expect(
      expectErr(await TwoFactorService.disableTotp('u1', 'senha', headers))
        .code,
    ).toBe('INVALID_CREDENTIALS')
  })
})
