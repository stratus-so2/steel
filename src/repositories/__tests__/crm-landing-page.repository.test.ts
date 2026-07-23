import { describe, expect, it } from 'vitest'
import {
  seedCrmLandingPage,
  seedCrmLandingPageView,
} from '@/src/__tests__/factories/crm-landing-page.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmLandingPageRepository,
  CrmLandingPageViewRepository,
} from '../crm-landing-page.repository'

describe('CrmLandingPageRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted pages', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmLandingPage(workspace.id, user.id)
      await seedCrmLandingPage(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmLandingPageRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.id)).toEqual([kept.id])
    })
  })

  describe('findByShareToken()', () => {
    it('should only return PUBLISHED pages', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const page = await seedCrmLandingPage(workspace.id, user.id, {
        status: 'DRAFT',
      })

      const result = await CrmLandingPageRepository.findByShareToken(
        page.shareToken,
      )
      expect(result.ok).toBe(false)
    })
  })

  describe('setPublished()', () => {
    it('should set publishedAt when publishing', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const page = await seedCrmLandingPage(workspace.id, user.id)

      const published = expectOk(
        await CrmLandingPageRepository.setPublished(page.id, true),
      )
      expect(published.status).toBe('PUBLISHED')
      expect(published.publishedAt).not.toBeNull()

      const found = expectOk(
        await CrmLandingPageRepository.findByShareToken(page.shareToken),
      )
      expect(found.id).toBe(page.id)
    })
  })
})

describe('CrmLandingPageViewRepository', () => {
  describe('record()', () => {
    it('should upsert by (landingPageId, viewId)', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const page = await seedCrmLandingPage(workspace.id, user.id)
      await seedCrmLandingPageView(page.id, { viewId: 'v1', durationMs: 10 })

      const updated = expectOk(
        await CrmLandingPageViewRepository.record({
          landingPageId: page.id,
          viewId: 'v1',
          ipHash: 'hash',
          durationMs: 50,
        }),
      )
      expect(updated.durationMs).toBe(50)

      const list = expectOk(
        await CrmLandingPageViewRepository.listByLandingPage(page.id),
      )
      expect(list).toHaveLength(1)
    })
  })
})
