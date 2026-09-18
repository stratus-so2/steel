import { describe, expect, it, vi } from 'vitest'
import { seedCrmLeadRoutingRule } from '@/src/__tests__/factories/crm-lead.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
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

    it('should return DATABASE_ERROR when the owner does not exist', async () => {
      const workspace = await seedWorkspace()
      expectErr(
        await CrmLeadRoutingRuleRepository.create({
          workspaceId: workspace.id,
          field: 'city',
          operator: 'is_empty',
          ownerId: 'missing-user',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list every rule of the workspace ordered by position', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const second = await seedCrmLeadRoutingRule(workspace.id, user.id, {
        position: 1,
        active: false,
      })
      const first = await seedCrmLeadRoutingRule(workspace.id, user.id, {
        position: 0,
      })
      await seedCrmLeadRoutingRule(other.id, user.id)

      const list = expectOk(
        await CrmLeadRoutingRuleRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((r) => r.id)).toEqual([first.id, second.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmLeadRoutingRule, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmLeadRoutingRuleRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
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

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmLeadRoutingRule, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmLeadRoutingRuleRepository.listActiveByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find a rule within its workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const rule = await seedCrmLeadRoutingRule(workspace.id, user.id)

      const found = expectOk(
        await CrmLeadRoutingRuleRepository.findById(rule.id, workspace.id),
      )
      expect(found.id).toBe(rule.id)
    })

    it('should return NOT_FOUND for a rule of another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const rule = await seedCrmLeadRoutingRule(other.id, user.id)

      expectErr(
        await CrmLeadRoutingRuleRepository.findById(rule.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmLeadRoutingRule, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmLeadRoutingRuleRepository.findById('r', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('should update the given fields', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const rule = await seedCrmLeadRoutingRule(workspace.id, user.id)

      const updated = expectOk(
        await CrmLeadRoutingRuleRepository.update(rule.id, {
          field: 'email',
          operator: 'contains',
          value: '@acme',
          active: false,
        }),
      )
      expect(updated).toMatchObject({
        field: 'email',
        operator: 'contains',
        value: '@acme',
        active: false,
      })
    })

    it('should return DATABASE_ERROR when the rule does not exist', async () => {
      expectErr(
        await CrmLeadRoutingRuleRepository.update('missing', { active: true }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('delete()', () => {
    it('should remove the rule', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const rule = await seedCrmLeadRoutingRule(workspace.id, user.id)

      expectOk(await CrmLeadRoutingRuleRepository.delete(rule.id))
      expectErr(
        await CrmLeadRoutingRuleRepository.findById(rule.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the rule does not exist', async () => {
      expectErr(
        await CrmLeadRoutingRuleRepository.delete('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})
