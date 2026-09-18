import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmLeadScoringRule } from '@/src/__tests__/factories/crm-lead.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-lead-scoring-rule.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { CrmLeadScoringRuleRepository } from '@/src/repositories/crm-lead-scoring-rule.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmLeadScoringRuleService } from '../crm-lead-scoring-rule.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedRepo = vi.mocked(CrmLeadScoringRuleRepository)
const mockedAudit = vi.mocked(auditMutation)

const dbError = () => err(databaseError('boom'))

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('CrmLeadScoringRuleService', () => {
  beforeEach(() => {
    asRole('MEMBER')
    mockedRepo.findById.mockResolvedValue(
      ok(createFakeCrmLeadScoringRule({ id: 'r1', workspaceId: 'ws1' })),
    )
  })

  describe('list()', () => {
    it('lists the workspace rules as DTOs', async () => {
      mockedRepo.listByWorkspace.mockResolvedValue(
        ok([
          createFakeCrmLeadScoringRule({ id: 'r1', points: 5 }),
          createFakeCrmLeadScoringRule({ id: 'r2', points: 20 }),
        ]),
      )

      const dtos = expectOk(await CrmLeadScoringRuleService.list('u1', 'ws1'))
      expect(dtos.map((d) => [d.id, d.points])).toEqual([
        ['r1', 5],
        ['r2', 20],
      ])
      expect(typeof dtos[0].createdAt).toBe('string')
      expect(mockedRepo.listByWorkspace).toHaveBeenCalledWith('ws1')
    })

    it('returns FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmLeadScoringRuleService.list('u1', 'ws1'), 'FORBIDDEN')
      expect(mockedRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('returns MODULE_DISABLED when CRM is off for the workspace', async () => {
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmLeadScoringRuleService.list('u1', 'ws1'),
        'MODULE_DISABLED',
      )
    })

    it('propagates repository errors', async () => {
      mockedRepo.listByWorkspace.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadScoringRuleService.list('u1', 'ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    const input = {
      field: 'email' as const,
      operator: 'contains' as const,
      value: '@acme.com',
      points: 15,
      active: true,
    }

    it('creates the rule and audits the success', async () => {
      mockedRepo.create.mockResolvedValue(
        ok(createFakeCrmLeadScoringRule({ id: 'r-new', points: 15 })),
      )

      const dto = expectOk(
        await CrmLeadScoringRuleService.create('u1', 'ws1', input),
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
        await CrmLeadScoringRuleService.create('u1', 'ws1', input),
        'FORBIDDEN',
      )
      expect(mockedRepo.create).not.toHaveBeenCalled()
    })

    it('audits and propagates repository failures', async () => {
      mockedRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadScoringRuleService.create('u1', 'ws1', input),
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
        ok(createFakeCrmLeadScoringRule({ id: 'r1', points: 99 })),
      )

      const dto = expectOk(
        await CrmLeadScoringRuleService.update('u1', 'ws1', 'r1', {
          points: 99,
        }),
      )
      expect(dto.points).toBe(99)
      expect(mockedRepo.findById).toHaveBeenCalledWith('r1', 'ws1')
      expect(mockedRepo.update).toHaveBeenCalledWith('r1', { points: 99 })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['points'] },
        }),
      )
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLeadScoringRuleService.update('u1', 'ws1', 'r1', {}),
        'FORBIDDEN',
      )
    })

    it('returns not found for a rule of another workspace', async () => {
      mockedRepo.findById.mockResolvedValue(err(notFound('Rule')))
      expectErr(
        await CrmLeadScoringRuleService.update('u1', 'ws1', 'r1', {}),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedRepo.update).not.toHaveBeenCalled()
    })

    it('propagates update failures', async () => {
      mockedRepo.update.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadScoringRuleService.update('u1', 'ws1', 'r1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    beforeEach(() => asRole('ADMIN'))

    it('returns FORBIDDEN for a MEMBER without delete permission', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmLeadScoringRuleService.remove('u1', 'ws1', 'r1'),
        'FORBIDDEN',
      )
    })

    it('deletes the rule', async () => {
      mockedRepo.delete.mockResolvedValue(ok(undefined))
      expectOk(await CrmLeadScoringRuleService.remove('u1', 'ws1', 'r1'))
      expect(mockedRepo.delete).toHaveBeenCalledWith('r1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 'r1' }),
      )
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmLeadScoringRuleService.remove('u1', 'ws1', 'r1'),
        'FORBIDDEN',
      )
      expect(mockedRepo.delete).not.toHaveBeenCalled()
    })

    it('returns not found for an unknown rule', async () => {
      mockedRepo.findById.mockResolvedValue(err(notFound('Rule')))
      expectErr(
        await CrmLeadScoringRuleService.remove('u1', 'ws1', 'r1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedRepo.delete).not.toHaveBeenCalled()
    })

    it('propagates delete failures', async () => {
      mockedRepo.delete.mockResolvedValue(dbError())
      expectErr(
        await CrmLeadScoringRuleService.remove('u1', 'ws1', 'r1'),
        'DATABASE_ERROR',
      )
    })
  })
})
