import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmLandingPage } from '@/src/__tests__/factories/crm-landing-page.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-landing-page.repository')

import {
  CrmLandingPageRepository,
  CrmLandingPageViewRepository,
} from '@/src/repositories/crm-landing-page.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmLandingPageService } from '../crm-landing-page.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedPageRepo = vi.mocked(CrmLandingPageRepository)
const mockedViewRepo = vi.mocked(CrmLandingPageViewRepository)

describe('CrmLandingPageService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmLandingPageService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('getPublicByShareToken()', () => {
    it('should return only title and html without auth', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        ok(
          createFakeCrmLandingPage({
            title: 'Home',
            html: '<p>Oi</p>',
            shareToken: 'tok',
          }),
        ),
      )

      const dto = expectOk(
        await CrmLandingPageService.getPublicByShareToken('tok'),
      )
      expect(dto).toEqual({ title: 'Home', html: '<p>Oi</p>' })
      expect(dto).not.toHaveProperty('shareToken')
    })
  })

  describe('recordView()', () => {
    it('should hash the ip before recording', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        ok(createFakeCrmLandingPage({ id: 'p1', shareToken: 'tok' })),
      )
      mockedViewRepo.record.mockResolvedValue(
        ok({
          id: 'v1',
          landingPageId: 'p1',
          viewId: 'view1',
          ipHash: 'hashed',
          durationMs: 0,
          ctaClicks: 0,
          referrer: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      expectOk(
        await CrmLandingPageService.recordView('tok', '1.2.3.4', {
          viewId: 'view1',
          durationMs: 0,
          ctaClicks: 0,
        }),
      )
      expect(mockedViewRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          ipHash: expect.not.stringContaining('1.2.3.4'),
        }),
      )
    })
  })
})
