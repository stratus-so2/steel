import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmSocialTrendingService } from '../crm-social-trending.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)

describe('CrmSocialTrendingService', () => {
  describe('getTodayRanking()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmSocialTrendingService.getTodayRanking('u1', 'ws1'),
        'FORBIDDEN',
      )
    })

    it('should return an empty ranking when no platform integration is configured', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )

      const items = expectOk(
        await CrmSocialTrendingService.getTodayRanking('u1', 'ws1'),
      )
      expect(items).toEqual([])
    })
  })
})
