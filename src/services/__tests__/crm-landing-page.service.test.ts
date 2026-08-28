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

function withSections(page: ReturnType<typeof createFakeCrmLandingPage>) {
  return { ...page, sections: [] }
}

describe('CrmLandingPageService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmLandingPageService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should reject an unknown templateKey', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )

      expectErr(
        await CrmLandingPageService.create('u1', 'ws1', {
          title: 'Home',
          templateKey: 'does-not-exist',
          sections: [],
        }),
        'CRM_LANDING_PAGE_TEMPLATE_NOT_FOUND',
      )
      expect(mockedPageRepo.create).not.toHaveBeenCalled()
    })

    it('should create with a valid templateKey, sections allowed to repeat a type', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedPageRepo.create.mockResolvedValue(
        ok(withSections(createFakeCrmLandingPage({ id: 'p1' }))),
      )

      const heroContent = { type: 'HERO' as const, title: 'Título' }
      expectOk(
        await CrmLandingPageService.create('u1', 'ws1', {
          title: 'Home',
          templateKey: 'agency',
          sections: [
            { type: 'HERO', order: 0, enabled: true, content: heroContent },
            { type: 'HERO', order: 1, enabled: true, content: heroContent },
          ],
        }),
      )
      expect(mockedPageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ templateKey: 'agency' }),
      )
    })
  })

  describe('update()', () => {
    it('should stamp publishedAt on the first publish', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const existing = withSections(
        createFakeCrmLandingPage({
          id: 'p1',
          status: 'DRAFT',
          publishedAt: null,
        }),
      )
      mockedPageRepo.findById.mockResolvedValue(ok(existing))
      mockedPageRepo.update.mockResolvedValue(
        ok({ ...existing, status: 'PUBLISHED', publishedAt: new Date() }),
      )

      expectOk(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {
          status: 'PUBLISHED',
        }),
      )
      expect(mockedPageRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        }),
      )
    })

    it('should not overwrite publishedAt when re-publishing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const originalPublishedAt = new Date('2026-01-01T00:00:00Z')
      const existing = withSections(
        createFakeCrmLandingPage({
          id: 'p1',
          status: 'DRAFT',
          publishedAt: originalPublishedAt,
        }),
      )
      mockedPageRepo.findById.mockResolvedValue(ok(existing))
      mockedPageRepo.update.mockResolvedValue(ok(existing))

      expectOk(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {
          status: 'PUBLISHED',
        }),
      )
      expect(mockedPageRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ publishedAt: undefined }),
      )
    })
  })

  describe('listViews()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmLandingPageService.listViews('u1', 'ws1', 'p1'),
        'FORBIDDEN',
      )
    })
  })

  describe('getPublicByShareToken()', () => {
    it('should return only public fields without auth', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        ok(
          withSections(
            createFakeCrmLandingPage({
              title: 'Home',
              templateKey: 'agency',
              shareToken: 'tok',
            }),
          ),
        ),
      )

      const dto = expectOk(
        await CrmLandingPageService.getPublicByShareToken('tok'),
      )
      expect(dto).toEqual({
        title: 'Home',
        templateKey: 'agency',
        sections: [],
      })
      expect(dto).not.toHaveProperty('shareToken')
    })
  })

  describe('recordView()', () => {
    it('should hash the ip before recording', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        ok(
          withSections(
            createFakeCrmLandingPage({ id: 'p1', shareToken: 'tok' }),
          ),
        ),
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
