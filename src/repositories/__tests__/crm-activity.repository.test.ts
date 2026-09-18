import { describe, expect, it, vi } from 'vitest'
import { seedCrmActivity } from '@/src/__tests__/factories/crm-activity.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmActivityRepository } from '../crm-activity.repository'

describe('CrmActivityRepository', () => {
  describe('record()', () => {
    it('should persist an activity entry', async () => {
      const workspace = await seedWorkspace()

      const result = await CrmActivityRepository.record({
        workspaceId: workspace.id,
        action: 'CREATED',
        entity: 'crm_company',
        entityId: 'c1',
        companyId: 'c1',
      })

      const activity = expectOk(result)
      expect(activity.action).toBe('CREATED')
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by companyId', async () => {
      const workspace = await seedWorkspace()
      const matched = await seedCrmActivity(workspace.id, {
        companyId: 'c1',
      })
      await seedCrmActivity(workspace.id, { companyId: 'c2' })

      const list = expectOk(
        await CrmActivityRepository.listByWorkspace(workspace.id, {
          companyId: 'c1',
        }),
      )
      expect(list.map((a) => a.id)).toEqual([matched.id])
    })
  })

  describe('listByWorkspace() filters and ordering', () => {
    it('should filter by personId and opportunityId and scope to the workspace', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      const byPerson = await seedCrmActivity(workspace.id, { personId: 'p1' })
      const byOpportunity = await seedCrmActivity(workspace.id, {
        opportunityId: 'o1',
      })
      await seedCrmActivity(other.id, { personId: 'p1' })

      expect(
        expectOk(
          await CrmActivityRepository.listByWorkspace(workspace.id, {
            personId: 'p1',
          }),
        ).map((a) => a.id),
      ).toEqual([byPerson.id])
      expect(
        expectOk(
          await CrmActivityRepository.listByWorkspace(workspace.id, {
            opportunityId: 'o1',
          }),
        ).map((a) => a.id),
      ).toEqual([byOpportunity.id])
    })

    it('should list newest first without filters', async () => {
      const workspace = await seedWorkspace()
      const older = await seedCrmActivity(workspace.id)
      await prisma.crmActivity.update({
        where: { id: older.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const newer = await seedCrmActivity(workspace.id)

      const list = expectOk(
        await CrmActivityRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((a) => a.id)).toEqual([newer.id, older.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmActivity, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmActivityRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('record() failures', () => {
    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      expectErr(
        await CrmActivityRepository.record({
          workspaceId: 'missing',
          action: 'CREATED',
          entity: 'crm_company',
          entityId: 'c1',
        }),
        'DATABASE_ERROR',
      )
    })
  })
})
