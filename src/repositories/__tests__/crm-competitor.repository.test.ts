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

  describe('listSyncable()', () => {
    it('should only include Instagram/YouTube competitors, excluding soft-deleted ones', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const ig = await seedCrmCompetitor(workspace.id, user.id, {
        platform: 'INSTAGRAM',
      })
      await seedCrmCompetitor(workspace.id, user.id, {
        platform: 'FACEBOOK',
      })
      await seedCrmCompetitor(workspace.id, user.id, {
        platform: 'YOUTUBE',
        deletedAt: new Date(),
      })

      const list = expectOk(await CrmCompetitorRepository.listSyncable())
      const ids = list.map((c) => c.id)
      expect(ids).toContain(ig.id)
      expect(ids).toHaveLength(1)
    })
  })

  describe('recordSyncResult()', () => {
    it('should persist the synced fields and status', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const competitor = await seedCrmCompetitor(workspace.id, user.id)
      const lastSyncedAt = new Date()

      const updated = expectOk(
        await CrmCompetitorRepository.recordSyncResult(competitor.id, {
          syncStatus: 'SYNCED',
          lastSyncedAt,
          followersCount: 5000,
          displayName: 'Rival Inc.',
        }),
      )
      expect(updated.syncStatus).toBe('SYNCED')
      expect(updated.followersCount).toBe(5000)
      expect(updated.displayName).toBe('Rival Inc.')
    })
  })

  describe('createSnapshot() / listSnapshotsSince()', () => {
    it('should record and list snapshots in chronological order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const competitor = await seedCrmCompetitor(workspace.id, user.id)

      await CrmCompetitorRepository.createSnapshot(competitor.id, {
        followersCount: 1000,
      })
      await CrmCompetitorRepository.createSnapshot(competitor.id, {
        followersCount: 1050,
        postsCount: 12,
      })

      const snapshots = expectOk(
        await CrmCompetitorRepository.listSnapshotsSince(
          competitor.id,
          new Date(Date.now() - 60_000),
        ),
      )
      expect(snapshots.map((s) => s.followersCount)).toEqual([1000, 1050])
    })
  })
})
