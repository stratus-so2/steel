import { describe, expect, it } from 'vitest'
import { seedCrmQuota } from '@/src/__tests__/factories/crm-quota.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
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
})
