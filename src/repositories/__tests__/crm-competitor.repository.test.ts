import { describe, expect, it } from 'vitest'
import { seedCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmCompetitorRepository } from '../crm-competitor.repository'

describe('CrmCompetitorRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted competitors', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmCompetitor(workspace.id, user.id)
      await seedCrmCompetitor(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmCompetitorRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((c) => c.id)).toEqual([kept.id])
    })
  })

  describe('reorder()', () => {
    it('should update positions across the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmCompetitor(workspace.id, user.id)
      const b = await seedCrmCompetitor(workspace.id, user.id)

      expectOk(
        await CrmCompetitorRepository.reorder(workspace.id, [b.id, a.id]),
      )

      const list = expectOk(
        await CrmCompetitorRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((c) => c.id)).toEqual([b.id, a.id])
    })
  })

  describe('softDelete()', () => {
    it('should stamp deletedAt and updatedById', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const competitor = await seedCrmCompetitor(workspace.id, user.id)

      expectOk(await CrmCompetitorRepository.softDelete(competitor.id, user.id))

      const found = await CrmCompetitorRepository.findById(
        competitor.id,
        workspace.id,
      )
      expect(found.ok).toBe(false)
    })
  })
})
