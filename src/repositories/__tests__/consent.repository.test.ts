import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { ConsentRepository } from '../consent.repository'

describe('ConsentRepository', () => {
  describe('recordCookieConsent()', () => {
    it('should persist a COOKIES consent event for the user', async () => {
      const user = await seedUser()

      expectOk(
        await ConsentRepository.recordCookieConsent({
          userId: user.id,
          version: '2026-01',
          action: 'GRANTED',
          ipAddress: '10.0.0.1',
          userAgent: 'vitest',
        }),
      )

      const events = await prisma.consentEvent.findMany({
        where: { userId: user.id },
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        document: 'COOKIES',
        version: '2026-01',
        action: 'GRANTED',
        ipAddress: '10.0.0.1',
        userAgent: 'vitest',
      })
    })

    it('should return DATABASE_ERROR when the user does not exist', async () => {
      expectErr(
        await ConsentRepository.recordCookieConsent({
          userId: 'missing-user',
          version: '2026-01',
          action: 'REVOKED',
          ipAddress: null,
          userAgent: null,
        }),
        'DATABASE_ERROR',
      )
    })
  })
})
