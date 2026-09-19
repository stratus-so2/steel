import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/consent.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { COOKIES_VERSION } from '@/lib/legal/versions'
import { ConsentRepository } from '@/src/repositories/consent.repository'
import { ConsentService } from '../consent.service'

const repo = vi.mocked(ConsentRepository)
const audit = vi.mocked(auditMutation)

const context = { ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConsentService.recordCookieConsent()', () => {
  it('records a GRANTED cookie consent with the current version and audits it', async () => {
    repo.recordCookieConsent.mockResolvedValue(ok({} as never))

    const value = expectOk(
      await ConsentService.recordCookieConsent('u1', true, context),
    )

    expect(value).toEqual({ accepted: true })
    expect(repo.recordCookieConsent).toHaveBeenCalledWith({
      userId: 'u1',
      version: COOKIES_VERSION,
      action: 'GRANTED',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    })
    expect(audit).toHaveBeenCalledWith({
      entity: 'consent',
      action: 'grant',
      actorId: 'u1',
      targetId: 'u1',
      meta: { document: 'COOKIES', version: COOKIES_VERSION, source: 'banner' },
    })
  })

  it('records a REVOKED consent when the banner is declined', async () => {
    repo.recordCookieConsent.mockResolvedValue(ok({} as never))

    const value = expectOk(
      await ConsentService.recordCookieConsent('u1', false, {
        ipAddress: null,
        userAgent: null,
      }),
    )

    expect(value).toEqual({ accepted: false })
    expect(repo.recordCookieConsent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REVOKED', ipAddress: null }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'revoke' }),
    )
  })

  it.each([
    [true, 'grant'],
    [false, 'revoke'],
  ] as const)('audits a failure and propagates the repository error (accepted=%s)', async (accepted, action) => {
    repo.recordCookieConsent.mockResolvedValue(err(databaseError('down')))

    const error = expectErr(
      await ConsentService.recordCookieConsent('u1', accepted, context),
    )

    expect(error.code).toBe('DATABASE_ERROR')
    expect(audit).toHaveBeenCalledTimes(1)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        outcome: 'failure',
        reason: 'DATABASE_ERROR',
      }),
    )
  })
})
