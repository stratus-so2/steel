import { describe, expect, it, vi } from 'vitest'
import { seedCrmQuota } from '@/src/__tests__/factories/crm-quota.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmQuotaRepository } from '../crm-quota.repository'

describe('CrmQuotaRepository', () => {
  describe('create()', () => {
    it('should return CRM_QUOTA_CONFLICT for a duplicate owner/period/periodKey', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmQuota(workspace.id, user.id, user.id)

      const result = await CrmQuotaRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        ownerId: user.id,
        period: 'MONTH',
        periodKey: '2026-08',
      })

      expectErr(result, 'CRM_QUOTA_CONFLICT')
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by ownerId', async () => {
      const [workspace, ownerA, ownerB] = await Promise.all([
        seedWorkspace(),
        seedUser(),
        seedUser(),
      ])
      const matched = await seedCrmQuota(workspace.id, ownerA.id, ownerA.id)
      await seedCrmQuota(workspace.id, ownerB.id, ownerB.id)

      const list = expectOk(
        await CrmQuotaRepository.listByWorkspace(workspace.id, {
          ownerId: ownerA.id,
        }),
      )
      expect(list.map((q) => q.id)).toEqual([matched.id])
    })
  })

  describe('create() / generic failures', () => {
    it('should persist a new quota with the target amount', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const quota = expectOk(
        await CrmQuotaRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          ownerId: user.id,
          period: 'QUARTER',
          periodKey: '2026-Q3',
          targetAmount: 1500,
        }),
      )
      expect(quota.period).toBe('QUARTER')
      expect(Number(quota.targetAmount)).toBe(1500)
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmQuotaRepository.create({
          workspaceId: 'missing-workspace',
          createdById: user.id,
          ownerId: user.id,
          period: 'MONTH',
          periodKey: '2026-09',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace() / period & scoping', () => {
    it('should filter by period, order by periodKey desc and never leak other workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const older = await seedCrmQuota(workspace.id, user.id, user.id, {
        periodKey: '2026-01',
      })
      const newer = await seedCrmQuota(workspace.id, user.id, user.id, {
        periodKey: '2026-05',
      })
      await seedCrmQuota(workspace.id, user.id, user.id, {
        period: 'QUARTER',
        periodKey: '2026-Q1',
      })
      await seedCrmQuota(other.id, user.id, user.id)

      const monthly = expectOk(
        await CrmQuotaRepository.listByWorkspace(workspace.id, {
          period: 'MONTH',
        }),
      )
      expect(monthly.map((q) => q.id)).toEqual([newer.id, older.id])

      const all = expectOk(
        await CrmQuotaRepository.listByWorkspace(workspace.id),
      )
      expect(all).toHaveLength(3)
      expect(all.every((q) => q.workspaceId === workspace.id)).toBe(true)
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmQuota, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmQuotaRepository.listByWorkspace('ws'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find a quota scoped to its workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const quota = await seedCrmQuota(workspace.id, user.id, user.id)

      expect(
        expectOk(await CrmQuotaRepository.findById(quota.id, workspace.id)).id,
      ).toBe(quota.id)
      expectErr(
        await CrmQuotaRepository.findById(quota.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmQuota, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await CrmQuotaRepository.findById('q', 'ws'), 'DATABASE_ERROR')
    })
  })

  describe('update()', () => {
    it('should update the target amount', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const quota = await seedCrmQuota(workspace.id, user.id, user.id)

      const updated = expectOk(
        await CrmQuotaRepository.update(quota.id, {
          targetAmount: 999,
          updatedById: user.id,
        }),
      )
      expect(Number(updated.targetAmount)).toBe(999)
      expect(updated.updatedById).toBe(user.id)
    })

    it('should return DATABASE_ERROR for a missing quota', async () => {
      expectErr(
        await CrmQuotaRepository.update('missing', { targetAmount: 1 }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('delete()', () => {
    it('should hard delete the quota', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const quota = await seedCrmQuota(workspace.id, user.id, user.id)

      expectOk(await CrmQuotaRepository.delete(quota.id))
      expectErr(
        await CrmQuotaRepository.findById(quota.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR for a missing quota', async () => {
      expectErr(await CrmQuotaRepository.delete('missing'), 'DATABASE_ERROR')
    })
  })
})
