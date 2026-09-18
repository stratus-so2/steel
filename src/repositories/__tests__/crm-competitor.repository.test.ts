import { describe, expect, it, vi } from 'vitest'
import { seedCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
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

  describe('findById() / create() / update()', () => {
    it('should create, find (workspace-scoped) and update a competitor', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])

      const created = expectOk(
        await CrmCompetitorRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          platform: 'YOUTUBE',
          handle: '@rival',
          followersCount: 10,
          notes: 'Monitorar',
        }),
      )
      expect(created.platform).toBe('YOUTUBE')

      expect(
        expectOk(
          await CrmCompetitorRepository.findById(created.id, workspace.id),
        ).handle,
      ).toBe('@rival')
      expectErr(
        await CrmCompetitorRepository.findById(created.id, other.id),
        'RESOURCE_NOT_FOUND',
      )

      const updated = expectOk(
        await CrmCompetitorRepository.update(created.id, {
          updatedById: user.id,
          handle: '@rival2',
          notes: null,
        }),
      )
      expect(updated.handle).toBe('@rival2')
      expect(updated.notes).toBeNull()
      expect(updated.updatedById).toBe(user.id)
    })

    it('should not find a soft-deleted competitor', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const deleted = await seedCrmCompetitor(workspace.id, user.id, {
        deletedAt: new Date(),
      })
      expectErr(
        await CrmCompetitorRepository.findById(deleted.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('listSyncable() scoped', () => {
    it('should restrict to the given workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const mine = await seedCrmCompetitor(workspace.id, user.id, {
        platform: 'YOUTUBE',
      })
      await seedCrmCompetitor(other.id, user.id, { platform: 'INSTAGRAM' })

      const list = expectOk(
        await CrmCompetitorRepository.listSyncable(workspace.id),
      )
      expect(list.map((c) => c.id)).toEqual([mine.id])
    })
  })

  describe('reorder() isolation', () => {
    it('should ignore ids from another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmCompetitor(other.id, user.id)

      expectOk(
        await CrmCompetitorRepository.reorder(workspace.id, [foreign.id]),
      )
      const stored = await prisma.crmTrackedCompetitor.findUniqueOrThrow({
        where: { id: foreign.id },
      })
      expect(stored.position).toBe(foreign.position)
    })
  })

  describe('database failures', () => {
    it('should return DATABASE_ERROR when writes hit missing rows or FKs', async () => {
      const user = await seedUser()
      expectErr(
        await CrmCompetitorRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          platform: 'INSTAGRAM',
          handle: '@x',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCompetitorRepository.update('missing', {
          updatedById: user.id,
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCompetitorRepository.softDelete('missing', user.id),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCompetitorRepository.recordSyncResult('missing', {
          syncStatus: 'SYNC_FAILED',
          lastSyncedAt: new Date(),
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCompetitorRepository.createSnapshot('missing', {
          followersCount: 1,
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when reads or the reorder transaction throw', async () => {
      const findMany = vi
        .spyOn(prisma.crmTrackedCompetitor, 'findMany')
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
      const findFirst = vi
        .spyOn(prisma.crmTrackedCompetitor, 'findFirst')
        .mockRejectedValueOnce(new Error('boom'))
      const snapshots = vi
        .spyOn(prisma.crmCompetitorMetricSnapshot, 'findMany')
        .mockRejectedValueOnce(new Error('boom'))
      const tx = vi
        .spyOn(prisma, '$transaction')
        .mockRejectedValueOnce(new Error('boom'))

      expectErr(
        await CrmCompetitorRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(await CrmCompetitorRepository.listSyncable(), 'DATABASE_ERROR')
      expectErr(
        await CrmCompetitorRepository.findById('c', 'w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCompetitorRepository.listSnapshotsSince('c', new Date()),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCompetitorRepository.reorder('w', ['c']),
        'DATABASE_ERROR',
      )

      for (const spy of [findMany, findFirst, snapshots, tx]) spy.mockRestore()
    })
  })
})
