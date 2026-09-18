import { describe, expect, it, vi } from 'vitest'
import { seedCrmLeadScoringRule } from '@/src/__tests__/factories/crm-lead.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
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

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      expectErr(
        await CrmLeadScoringRuleRepository.create({
          workspaceId: 'missing-workspace',
          field: 'email',
          operator: 'is_not_empty',
          points: 5,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list every rule of the workspace ordered by position', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      const second = await seedCrmLeadScoringRule(workspace.id, {
        position: 1,
        active: false,
      })
      const first = await seedCrmLeadScoringRule(workspace.id, { position: 0 })
      await seedCrmLeadScoringRule(other.id)

      const list = expectOk(
        await CrmLeadScoringRuleRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((r) => r.id)).toEqual([first.id, second.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmLeadScoringRule, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmLeadScoringRuleRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
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

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmLeadScoringRule, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmLeadScoringRuleRepository.listActiveByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find a rule within its workspace', async () => {
      const workspace = await seedWorkspace()
      const rule = await seedCrmLeadScoringRule(workspace.id)

      const found = expectOk(
        await CrmLeadScoringRuleRepository.findById(rule.id, workspace.id),
      )
      expect(found.points).toBe(10)
    })

    it('should return NOT_FOUND for a rule of another workspace', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      const rule = await seedCrmLeadScoringRule(other.id)

      expectErr(
        await CrmLeadScoringRuleRepository.findById(rule.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmLeadScoringRule, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmLeadScoringRuleRepository.findById('r', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('should update the given fields', async () => {
      const workspace = await seedWorkspace()
      const rule = await seedCrmLeadScoringRule(workspace.id)

      const updated = expectOk(
        await CrmLeadScoringRuleRepository.update(rule.id, {
          field: 'jobTitle',
          operator: 'contains',
          value: 'CEO',
          points: 40,
          active: false,
        }),
      )
      expect(updated).toMatchObject({
        field: 'jobTitle',
        operator: 'contains',
        value: 'CEO',
        points: 40,
        active: false,
      })
    })

    it('should return DATABASE_ERROR when the rule does not exist', async () => {
      expectErr(
        await CrmLeadScoringRuleRepository.update('missing', { points: 1 }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('delete()', () => {
    it('should remove the rule', async () => {
      const workspace = await seedWorkspace()
      const rule = await seedCrmLeadScoringRule(workspace.id)

      expectOk(await CrmLeadScoringRuleRepository.delete(rule.id))
      expectErr(
        await CrmLeadScoringRuleRepository.findById(rule.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the rule does not exist', async () => {
      expectErr(
        await CrmLeadScoringRuleRepository.delete('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})
