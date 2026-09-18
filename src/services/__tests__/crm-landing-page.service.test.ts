import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmLandingPage } from '@/src/__tests__/factories/crm-landing-page.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-landing-page.repository')

import {
  CrmLandingPageRepository,
  CrmLandingPageViewRepository,
} from '@/src/repositories/crm-landing-page.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmLandingPageService } from '../crm-landing-page.service'

const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)
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
        ok(createFakeMembership({ role: 'MEMBER' })),
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
        ok(createFakeMembership({ role: 'MEMBER' })),
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
        ok(createFakeMembership({ role: 'MEMBER' })),
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
        ok(createFakeMembership({ role: 'MEMBER' })),
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

const dbError = () => err(databaseError('boom'))

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

function fakeView(id: string) {
  return {
    id,
    landingPageId: 'p1',
    viewId: `view-${id}`,
    ipHash: 'hashed',
    durationMs: 1200,
    ctaClicks: 2,
    referrer: 'https://google.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('CrmLandingPageService — management', () => {
  const page = () =>
    withSections(createFakeCrmLandingPage({ id: 'p1', workspaceId: 'ws1' }))

  beforeEach(() => {
    asRole('MEMBER')
    mockedPageRepo.findById.mockResolvedValue(ok(page()))
  })

  describe('list()', () => {
    it('lists the workspace pages', async () => {
      mockedPageRepo.listByWorkspace.mockResolvedValue(
        ok([{ ...page(), _count: { views: 3 } }]),
      )
      const dtos = expectOk(await CrmLandingPageService.list('u1', 'ws1'))
      expect(dtos.map((d) => d.id)).toEqual(['p1'])
      expect(mockedPageRepo.listByWorkspace).toHaveBeenCalledWith('ws1')
    })

    it('returns MODULE_DISABLED when CRM is off', async () => {
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmLandingPageService.list('u1', 'ws1'),
        'MODULE_DISABLED',
      )
    })

    it('propagates repository errors', async () => {
      mockedPageRepo.listByWorkspace.mockResolvedValue(dbError())
      expectErr(await CrmLandingPageService.list('u1', 'ws1'), 'DATABASE_ERROR')
    })
  })

  describe('getById()', () => {
    it('returns the page of the workspace', async () => {
      const dto = expectOk(
        await CrmLandingPageService.getById('u1', 'ws1', 'p1'),
      )
      expect(dto.id).toBe('p1')
      expect(mockedPageRepo.findById).toHaveBeenCalledWith('p1', 'ws1')
    })

    it('returns FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmLandingPageService.getById('u1', 'ws1', 'p1'),
        'FORBIDDEN',
      )
    })

    it('returns not found for a page of another workspace', async () => {
      mockedPageRepo.findById.mockResolvedValue(err(notFound('Landing page')))
      expectErr(
        await CrmLandingPageService.getById('u1', 'ws1', 'p1'),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('create()', () => {
    const input = { title: 'Home', templateKey: 'agency', sections: [] }

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLandingPageService.create('u1', 'ws1', input),
        'FORBIDDEN',
      )
      expect(mockedPageRepo.create).not.toHaveBeenCalled()
    })

    it('propagates repository failures', async () => {
      mockedPageRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmLandingPageService.create('u1', 'ws1', input),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('does not stamp publishedAt when not publishing', async () => {
      mockedPageRepo.update.mockResolvedValue(ok(page()))
      expectOk(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {
          title: 'Nova',
        }),
      )
      expect(mockedPageRepo.update).toHaveBeenCalledWith('p1', {
        title: 'Nova',
        sections: undefined,
        status: undefined,
        publishedAt: undefined,
        updatedById: 'u1',
      })
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {}),
        'FORBIDDEN',
      )
    })

    it('returns not found for a page of another workspace', async () => {
      mockedPageRepo.findById.mockResolvedValue(err(notFound('Landing page')))
      expectErr(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {}),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedPageRepo.update).not.toHaveBeenCalled()
    })

    it('propagates update failures', async () => {
      mockedPageRepo.update.mockResolvedValue(dbError())
      expectErr(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('setPublished()', () => {
    it('toggles the published flag', async () => {
      mockedPageRepo.setPublished.mockResolvedValue(
        ok({ ...page(), status: 'PUBLISHED' as const }),
      )
      const dto = expectOk(
        await CrmLandingPageService.setPublished('u1', 'ws1', 'p1', true),
      )
      expect(dto.status).toBe('PUBLISHED')
      expect(mockedPageRepo.setPublished).toHaveBeenCalledWith('p1', true)
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLandingPageService.setPublished('u1', 'ws1', 'p1', false),
        'FORBIDDEN',
      )
    })

    it('returns not found for an unknown page', async () => {
      mockedPageRepo.findById.mockResolvedValue(err(notFound('Landing page')))
      expectErr(
        await CrmLandingPageService.setPublished('u1', 'ws1', 'p1', true),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedPageRepo.setPublished).not.toHaveBeenCalled()
    })

    it('propagates repository failures', async () => {
      mockedPageRepo.setPublished.mockResolvedValue(dbError())
      expectErr(
        await CrmLandingPageService.setPublished('u1', 'ws1', 'p1', true),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    beforeEach(() => asRole('ADMIN'))

    it('soft-deletes the page', async () => {
      mockedPageRepo.softDelete.mockResolvedValue(ok(undefined))
      expectOk(await CrmLandingPageService.remove('u1', 'ws1', 'p1'))
      expect(mockedPageRepo.softDelete).toHaveBeenCalledWith('p1')
    })

    it('returns FORBIDDEN for a MEMBER without delete permission', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmLandingPageService.remove('u1', 'ws1', 'p1'),
        'FORBIDDEN',
      )
      expect(mockedPageRepo.softDelete).not.toHaveBeenCalled()
    })

    it('returns not found for an unknown page', async () => {
      mockedPageRepo.findById.mockResolvedValue(err(notFound('Landing page')))
      expectErr(
        await CrmLandingPageService.remove('u1', 'ws1', 'p1'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('propagates delete failures', async () => {
      mockedPageRepo.softDelete.mockResolvedValue(dbError())
      expectErr(
        await CrmLandingPageService.remove('u1', 'ws1', 'p1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('reorder()', () => {
    it('delegates the order to the repository', async () => {
      mockedPageRepo.reorder.mockResolvedValue(ok(undefined))
      expectOk(await CrmLandingPageService.reorder('u1', 'ws1', ['b', 'a']))
      expect(mockedPageRepo.reorder).toHaveBeenCalledWith('ws1', ['b', 'a'])
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLandingPageService.reorder('u1', 'ws1', []),
        'FORBIDDEN',
      )
      expect(mockedPageRepo.reorder).not.toHaveBeenCalled()
    })
  })

  describe('listViews()', () => {
    it('lists the views of the page', async () => {
      mockedViewRepo.listByLandingPage.mockResolvedValue(
        ok([fakeView('v1'), fakeView('v2')]),
      )
      const dtos = expectOk(
        await CrmLandingPageService.listViews('u1', 'ws1', 'p1'),
      )
      expect(dtos.map((d) => d.id)).toEqual(['v1', 'v2'])
      expect(dtos[0]).toMatchObject({ durationMs: 1200, ctaClicks: 2 })
      expect(mockedViewRepo.listByLandingPage).toHaveBeenCalledWith('p1')
    })

    it('returns not found for a page of another workspace', async () => {
      mockedPageRepo.findById.mockResolvedValue(err(notFound('Landing page')))
      expectErr(
        await CrmLandingPageService.listViews('u1', 'ws1', 'p1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedViewRepo.listByLandingPage).not.toHaveBeenCalled()
    })

    it('propagates listing failures', async () => {
      mockedViewRepo.listByLandingPage.mockResolvedValue(dbError())
      expectErr(
        await CrmLandingPageService.listViews('u1', 'ws1', 'p1'),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('CrmLandingPageService — public routes', () => {
  const published = () =>
    withSections(
      createFakeCrmLandingPage({
        id: 'p1',
        workspaceId: 'ws1',
        shareToken: 'tok',
      }),
    )

  describe('getPublicByShareToken()', () => {
    it('returns not found for an unknown token', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        err(notFound('Landing page')),
      )
      expectErr(
        await CrmLandingPageService.getPublicByShareToken('nope'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('hides the page when the CRM module is disabled', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(ok(published()))
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmLandingPageService.getPublicByShareToken('tok'),
        'MODULE_DISABLED',
      )
      expect(mockedModuleAccess.isEnabled).toHaveBeenCalledWith('ws1', 'CRM')
    })
  })

  describe('recordView()', () => {
    const view = { viewId: 'view1', durationMs: 10, ctaClicks: 1 }

    it('stores the sha256 of the ip, never the raw ip', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(ok(published()))
      mockedViewRepo.record.mockResolvedValue(ok(fakeView('v1')))

      expectOk(await CrmLandingPageService.recordView('tok', '10.0.0.1', view))
      expect(mockedViewRepo.record).toHaveBeenCalledWith({
        landingPageId: 'p1',
        viewId: 'view1',
        ipHash: createHash('sha256').update('10.0.0.1').digest('hex'),
        durationMs: 10,
        ctaClicks: 1,
        referrer: undefined,
      })
    })

    it('returns not found for an unknown token', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        err(notFound('Landing page')),
      )
      expectErr(
        await CrmLandingPageService.recordView('nope', '1.1.1.1', view),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedViewRepo.record).not.toHaveBeenCalled()
    })

    it('does not record views when the CRM module is disabled', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(ok(published()))
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmLandingPageService.recordView('tok', '1.1.1.1', view),
        'MODULE_DISABLED',
      )
      expect(mockedViewRepo.record).not.toHaveBeenCalled()
    })

    it('propagates recording failures', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(ok(published()))
      mockedViewRepo.record.mockResolvedValue(dbError())
      expectErr(
        await CrmLandingPageService.recordView('tok', '1.1.1.1', view),
        'DATABASE_ERROR',
      )
    })
  })
})
