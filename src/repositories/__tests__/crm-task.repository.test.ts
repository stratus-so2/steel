import { describe, expect, it } from 'vitest'
import { seedCrmTask } from '@/src/__tests__/factories/crm-task.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmTaskRepository } from '../crm-task.repository'

describe('CrmTaskRepository', () => {
  describe('listByWorkspace()', () => {
    it('should filter by status and exclude soft-deleted', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const done = await seedCrmTask(workspace.id, user.id, {
        status: 'DONE',
      })
      await seedCrmTask(workspace.id, user.id, { status: 'TODO' })
      await seedCrmTask(workspace.id, user.id, {
        status: 'DONE',
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmTaskRepository.listByWorkspace(workspace.id, {
          status: 'DONE',
        }),
      )
      expect(list.map((t) => t.id)).toEqual([done.id])
    })
  })

  describe('findById()', () => {
    it('should return RESOURCE_NOT_FOUND for another workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const seeded = await seedCrmTask(workspaceA.id, user.id)

      expectErr(
        await CrmTaskRepository.findById(seeded.id, workspaceB.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })
})
