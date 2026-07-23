import { describe, expect, it } from 'vitest'
import { seedCrmLeadRoutingRule } from '@/src/__tests__/factories/crm-lead.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmLeadRoutingRuleRepository } from '../crm-lead-routing-rule.repository'

describe('CrmLeadRoutingRuleRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmLeadRoutingRule(workspace.id, user.id)

      const result = await CrmLeadRoutingRuleRepository.create({
        workspaceId: workspace.id,
        field: 'source',
        operator: 'equals',
        value: 'ads',
        ownerId: user.id,
      })

      const rule = expectOk(result)
      expect(rule.position).toBe(1)
    })
  })

  describe('listActiveByWorkspace()', () => {
    it('should exclude inactive rules', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const active = await seedCrmLeadRoutingRule(workspace.id, user.id, {
        active: true,
      })
      await seedCrmLeadRoutingRule(workspace.id, user.id, { active: false })

      const list = expectOk(
        await CrmLeadRoutingRuleRepository.listActiveByWorkspace(workspace.id),
      )
      expect(list.map((r) => r.id)).toEqual([active.id])
    })
  })
})
