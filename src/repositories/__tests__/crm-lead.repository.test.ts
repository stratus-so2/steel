import { describe, expect, it } from 'vitest'
import { seedCrmLead } from '@/src/__tests__/factories/crm-lead.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmLeadRepository } from '../crm-lead.repository'

describe('CrmLeadRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmLead(workspace.id, user.id)

      const result = await CrmLeadRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Second',
        score: 0,
      })

      const lead = expectOk(result)
      expect(lead.position).toBe(1)
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by status when provided', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const qualified = await seedCrmLead(workspace.id, user.id, {
        status: 'QUALIFIED',
      })
      await seedCrmLead(workspace.id, user.id, { status: 'NEW' })

      const list = expectOk(
        await CrmLeadRepository.listByWorkspace(workspace.id, {
          status: 'QUALIFIED',
        }),
      )
      expect(list.map((l) => l.id)).toEqual([qualified.id])
    })

    it('should exclude soft-deleted leads', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmLead(workspace.id, user.id)
      await seedCrmLead(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmLeadRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((l) => l.id)).toEqual([kept.id])
    })
  })

  describe('findById()', () => {
    it('should return RESOURCE_NOT_FOUND for another workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const seeded = await seedCrmLead(workspaceA.id, user.id)

      expectErr(
        await CrmLeadRepository.findById(seeded.id, workspaceB.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })
})
