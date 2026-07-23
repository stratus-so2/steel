import { describe, expect, it } from 'vitest'
import { seedCrmActivity } from '@/src/__tests__/factories/crm-activity.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
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
})
