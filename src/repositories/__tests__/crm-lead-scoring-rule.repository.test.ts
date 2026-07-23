import { describe, expect, it } from 'vitest'
import { seedCrmLeadScoringRule } from '@/src/__tests__/factories/crm-lead.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmLeadScoringRuleRepository } from '../crm-lead-scoring-rule.repository'

describe('CrmLeadScoringRuleRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const workspace = await seedWorkspace()
      await seedCrmLeadScoringRule(workspace.id)

      const result = await CrmLeadScoringRuleRepository.create({
        workspaceId: workspace.id,
        field: 'source',
        operator: 'equals',
        value: 'ads',
      })

      const rule = expectOk(result)
      expect(rule.position).toBe(1)
    })
  })

  describe('listActiveByWorkspace()', () => {
    it('should exclude inactive rules', async () => {
      const workspace = await seedWorkspace()
      const active = await seedCrmLeadScoringRule(workspace.id, {
        active: true,
      })
      await seedCrmLeadScoringRule(workspace.id, { active: false })

      const list = expectOk(
        await CrmLeadScoringRuleRepository.listActiveByWorkspace(workspace.id),
      )
      expect(list.map((r) => r.id)).toEqual([active.id])
    })
  })
})
