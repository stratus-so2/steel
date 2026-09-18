import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmLeadRoutingRule } from '@/src/__tests__/factories/crm-lead.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-lead-routing-rule.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { CrmLeadRoutingRuleRepository } from '@/src/repositories/crm-lead-routing-rule.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmLeadRoutingRuleService } from '../crm-lead-routing-rule.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedRepo = vi.mocked(CrmLeadRoutingRuleRepository)
const mockedAudit = vi.mocked(auditMutation)

const dbError = () => err(databaseError('boom'))

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('CrmLeadRoutingRuleService', () => {
  beforeEach(() => {
    asRole('MEMBER')
    mockedRepo.findById.mockResolvedValue(
      ok(createFakeCrmLeadRoutingRule({ id: 'r1', workspaceId: 'ws1' })),
    )
  })

  describe('list()', () => {
    it('lists the workspace rules as DTOs', async () => {
      mockedRepo.listByWorkspace.mockResolvedValue(
        ok([
          createFakeCrmLeadRoutingRule({ id: 'r1', ownerId: 'o5' }),
          createFakeCrmLeadRoutingRule({ id: 'r2', ownerId: 'o20' }),
        ]),
      )

      const dtos = expectOk(await CrmLeadRoutingRuleService.list('u1', 'ws1'))
      expect(dtos.map((d) => [d.id, d.ownerId])).toEqual([
        ['r1', 'o5'],
        ['r2', 'o20'],
      ])
      expect(typeof dtos[0].createdAt).toBe('string')
      expect(mockedRepo.listByWorkspace).toHaveBeenCalledWith('ws1')
    })

    it('returns FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmLeadRoutingRuleService.list('u1', 'ws1'), 'FORBIDDEN')
      expect(mockedRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('returns MODULE_DISABLED when CRM is off for the workspace', async () => {
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmLeadRoutingRuleService.list('u1', 'ws1'),
        'MODULE_DISABLED',
      )
    })

    it('propagates repository errors', async () => {
      mockedRepo.listByWorkspace.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadRoutingRuleService.list('u1', 'ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    const input = {
      field: 'email' as const,
      operator: 'contains' as const,
      value: '@acme.com',
      ownerId: 'owner-1',
      active: true,
    }

    it('creates the rule and audits the success', async () => {
      mockedRepo.create.mockResolvedValue(
        ok(createFakeCrmLeadRoutingRule({ id: 'r-new', ownerId: 'owner-1' })),
      )

      const dto = expectOk(
        await CrmLeadRoutingRuleService.create('u1', 'ws1', input),
      )
      expect(dto.id).toBe('r-new')
      expect(mockedRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        ...input,
      })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', targetId: 'r-new' }),
      )
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLeadRoutingRuleService.create('u1', 'ws1', input),
        'FORBIDDEN',
      )
      expect(mockedRepo.create).not.toHaveBeenCalled()
    })

    it('audits and propagates repository failures', async () => {
      mockedRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadRoutingRuleService.create('u1', 'ws1', input),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })
  })

  describe('update()', () => {
    it('updates a rule of the workspace', async () => {
      mockedRepo.update.mockResolvedValue(
        ok(createFakeCrmLeadRoutingRule({ id: 'r1', ownerId: 'o99' })),
      )

      const dto = expectOk(
        await CrmLeadRoutingRuleService.update('u1', 'ws1', 'r1', {
          ownerId: 'o99',
        }),
      )
      expect(dto.ownerId).toBe('o99')
      expect(mockedRepo.findById).toHaveBeenCalledWith('r1', 'ws1')
      expect(mockedRepo.update).toHaveBeenCalledWith('r1', { ownerId: 'o99' })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['ownerId'] },
        }),
      )
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLeadRoutingRuleService.update('u1', 'ws1', 'r1', {}),
        'FORBIDDEN',
      )
    })

    it('returns not found for a rule of another workspace', async () => {
      mockedRepo.findById.mockResolvedValue(err(notFound('Rule')))
      expectErr(
        await CrmLeadRoutingRuleService.update('u1', 'ws1', 'r1', {}),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedRepo.update).not.toHaveBeenCalled()
    })

    it('propagates update failures', async () => {
      mockedRepo.update.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadRoutingRuleService.update('u1', 'ws1', 'r1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    beforeEach(() => asRole('ADMIN'))

    it('returns FORBIDDEN for a MEMBER without delete permission', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmLeadRoutingRuleService.remove('u1', 'ws1', 'r1'),
        'FORBIDDEN',
      )
    })

    it('deletes the rule', async () => {
      mockedRepo.delete.mockResolvedValue(ok(undefined))
      expectOk(await CrmLeadRoutingRuleService.remove('u1', 'ws1', 'r1'))
      expect(mockedRepo.delete).toHaveBeenCalledWith('r1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 'r1' }),
      )
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLeadRoutingRuleService.remove('u1', 'ws1', 'r1'),
        'FORBIDDEN',
      )
      expect(mockedRepo.delete).not.toHaveBeenCalled()
    })

    it('returns not found for an unknown rule', async () => {
      mockedRepo.findById.mockResolvedValue(err(notFound('Rule')))
      expectErr(
        await CrmLeadRoutingRuleService.remove('u1', 'ws1', 'r1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedRepo.delete).not.toHaveBeenCalled()
    })

    it('propagates delete failures', async () => {
      mockedRepo.delete.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadRoutingRuleService.remove('u1', 'ws1', 'r1'),
        'DATABASE_ERROR',
      )
    })
  })
})
