import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmQuota } from '@/src/__tests__/factories/crm-quota.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { conflict, databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-quota.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { CrmQuotaRepository } from '@/src/repositories/crm-quota.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmQuotaService } from '../crm-quota.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedQuotaRepo = vi.mocked(CrmQuotaRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const mockedAudit = vi.mocked(auditMutation)

function asRole(role: Role) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

const createDto = {
  ownerId: 'owner1',
  period: 'MONTH' as const,
  periodKey: '2026-09',
  targetAmount: 50_000,
}

beforeEach(() => {
  mockedModuleAccess.isEnabled.mockResolvedValue(ok(true))
})

describe('CrmQuotaService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a plain member', async () => {
      asRole('MEMBER')
      expectErr(await CrmQuotaService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(await CrmQuotaService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmQuotaService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return MODULE_DISABLED when the CRM is off, even for an ADMIN', async () => {
      asRole('ADMIN')
      mockedModuleAccess.isEnabled.mockResolvedValue(ok(false))
      expectErr(await CrmQuotaService.list('u1', 'ws1', {}), 'MODULE_DISABLED')
    })

    it('should return quotas for a privileged member, forwarding filters', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmQuota({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(
        await CrmQuotaService.list('u1', 'ws1', { period: 'QUARTER' }),
      )
      expect(dtos).toHaveLength(1)
      expect(mockedQuotaRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
        period: 'QUARTER',
      })
    })

    it('should propagate a repository error', async () => {
      asRole('OWNER')
      mockedQuotaRepo.listByWorkspace.mockResolvedValue(err(databaseError()))
      expectErr(await CrmQuotaService.list('u1', 'ws1', {}), 'DATABASE_ERROR')
    })
  })

  describe('create()', () => {
    it('should return FORBIDDEN for a MEMBER (quotas are admin-only)', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmQuotaService.create('u1', 'ws1', createDto),
        'FORBIDDEN',
      )
      expect(mockedQuotaRepo.create).not.toHaveBeenCalled()
    })

    it('should create a quota for an ADMIN and audit it', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.create.mockResolvedValue(
        ok(createFakeCrmQuota({ id: 'q1', ownerId: 'owner1' })),
      )

      const dto = expectOk(await CrmQuotaService.create('u1', 'ws1', createDto))
      expect(dto.id).toBe('q1')
      expect(mockedQuotaRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        createdById: 'u1',
        ...createDto,
      })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'crm_quota',
          action: 'create',
          targetId: 'q1',
        }),
      )
    })

    it('should audit a failure on a duplicate owner+period', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.create.mockResolvedValue(
        err(conflict('Meta já existe para este período')),
      )

      expectErr(
        await CrmQuotaService.create('u1', 'ws1', createDto),
        'CONFLICT',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failure', reason: 'CONFLICT' }),
      )
    })
  })

  describe('update()', () => {
    it('should return FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmQuotaService.update('u1', 'ws1', 'q1', { targetAmount: 1 }),
        'FORBIDDEN',
      )
    })

    it('should return not found for a quota outside the workspace', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.findById.mockResolvedValue(err(notFound('CrmQuota')))
      expectErr(
        await CrmQuotaService.update('u1', 'ws1', 'q1', { targetAmount: 1 }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedQuotaRepo.update).not.toHaveBeenCalled()
    })

    it('should propagate an update failure', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.findById.mockResolvedValue(ok(createFakeCrmQuota()))
      mockedQuotaRepo.update.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmQuotaService.update('u1', 'ws1', 'q1', { targetAmount: 1 }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })

    it('should update the target and audit the changed fields', async () => {
      asRole('OWNER')
      mockedQuotaRepo.findById.mockResolvedValue(
        ok(createFakeCrmQuota({ id: 'q1' })),
      )
      mockedQuotaRepo.update.mockResolvedValue(
        ok(createFakeCrmQuota({ id: 'q1' })),
      )

      expectOk(
        await CrmQuotaService.update('u1', 'ws1', 'q1', {
          targetAmount: 75_000,
        }),
      )
      expect(mockedQuotaRepo.findById).toHaveBeenCalledWith('q1', 'ws1')
      expect(mockedQuotaRepo.update).toHaveBeenCalledWith('q1', {
        targetAmount: 75_000,
        updatedById: 'u1',
      })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['targetAmount'] },
        }),
      )
    })
  })

  describe('remove()', () => {
    it('should return FORBIDDEN for a MEMBER', async () => {
      asRole('MEMBER')
      expectErr(await CrmQuotaService.remove('u1', 'ws1', 'q1'), 'FORBIDDEN')
      expect(mockedQuotaRepo.delete).not.toHaveBeenCalled()
    })

    it('should return not found for an unknown quota', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.findById.mockResolvedValue(err(notFound('CrmQuota')))
      expectErr(
        await CrmQuotaService.remove('u1', 'ws1', 'q1'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should propagate a delete failure', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.findById.mockResolvedValue(ok(createFakeCrmQuota()))
      mockedQuotaRepo.delete.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmQuotaService.remove('u1', 'ws1', 'q1'),
        'DATABASE_ERROR',
      )
    })

    it('should delete for an ADMIN and audit it', async () => {
      asRole('ADMIN')
      mockedQuotaRepo.findById.mockResolvedValue(ok(createFakeCrmQuota()))
      mockedQuotaRepo.delete.mockResolvedValue(ok(undefined as never))
      expectOk(await CrmQuotaService.remove('u1', 'ws1', 'q1'))
      expect(mockedQuotaRepo.delete).toHaveBeenCalledWith('q1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 'q1' }),
      )
    })
  })
})
