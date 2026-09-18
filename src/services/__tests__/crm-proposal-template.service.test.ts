import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmProposalTemplate } from '@/src/__tests__/factories/crm-proposal-template.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-proposal-template.repository')

import type { Role } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { CrmProposalTemplateRepository } from '@/src/repositories/crm-proposal-template.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmProposalTemplateService } from '../crm-proposal-template.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedTemplateRepo = vi.mocked(CrmProposalTemplateRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const mockedAudit = vi.mocked(auditMutation)

function asRole(role: Role) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

function fakeTemplate(overrides = {}) {
  return {
    ...createFakeCrmProposalTemplate({ id: 't1', name: 'Template X' }),
    sections: [],
    ...overrides,
  }
}

describe('CrmProposalTemplateService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmProposalTemplateService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return MODULE_DISABLED when the CRM module is off', async () => {
      asRole('OWNER')
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmProposalTemplateService.list('u1', 'ws1'),
        'MODULE_DISABLED',
      )
      expect(mockedTemplateRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should list templates as DTOs for a VIEWER', async () => {
      asRole('VIEWER')
      mockedTemplateRepo.listByWorkspace.mockResolvedValue(
        ok([fakeTemplate(), fakeTemplate({ id: 't2', name: 'Y' })]),
      )
      const list = expectOk(await CrmProposalTemplateService.list('u1', 'ws1'))
      expect(list.map((t) => t.id)).toEqual(['t1', 't2'])
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.listByWorkspace.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmProposalTemplateService.list('u1', 'ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('getById()', () => {
    it('should return the template DTO', async () => {
      asRole('VIEWER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(fakeTemplate()))
      const dto = expectOk(
        await CrmProposalTemplateService.getById('u1', 'ws1', 't1'),
      )
      expect(dto.id).toBe('t1')
      expect(mockedTemplateRepo.findById).toHaveBeenCalledWith('t1', 'ws1')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmProposalTemplateService.getById('u1', 'ws1', 't1'),
        'FORBIDDEN',
      )
    })

    it('should propagate NOT_FOUND', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(err(notFound('Template')))
      expectErr(
        await CrmProposalTemplateService.getById('u1', 'ws1', 't1'),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('create()', () => {
    it('should create a template with the given sections', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.create.mockResolvedValue(ok(fakeTemplate()))

      const dto = expectOk(
        await CrmProposalTemplateService.create('u1', 'ws1', {
          name: 'Template X',
          sections: [],
        }),
      )
      expect(dto.name).toBe('Template X')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', targetId: 't1' }),
      )
    })

    it('should deny a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmProposalTemplateService.create('u1', 'ws1', {
          name: 'X',
          sections: [],
        }),
        'FORBIDDEN',
      )
      expect(mockedTemplateRepo.create).not.toHaveBeenCalled()
    })

    it('should audit a failure when the repository fails', async () => {
      asRole('ADMIN')
      mockedTemplateRepo.create.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmProposalTemplateService.create('u1', 'ws1', {
          name: 'X',
          sections: [],
        }),
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
    it('should update an existing template and audit changed fields', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(fakeTemplate()))
      mockedTemplateRepo.update.mockResolvedValue(
        ok(fakeTemplate({ name: 'Novo' })),
      )
      const dto = expectOk(
        await CrmProposalTemplateService.update('u1', 'ws1', 't1', {
          name: 'Novo',
        }),
      )
      expect(dto.name).toBe('Novo')
      expect(mockedTemplateRepo.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ name: 'Novo', updatedById: 'u1' }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['name'] },
        }),
      )
    })

    it('should deny a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmProposalTemplateService.update('u1', 'ws1', 't1', {
          name: 'X',
        }),
        'FORBIDDEN',
      )
    })

    it('should return NOT_FOUND when the template does not exist', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(err(notFound('Template')))
      expectErr(
        await CrmProposalTemplateService.update('u1', 'ws1', 't1', {
          name: 'X',
        }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedTemplateRepo.update).not.toHaveBeenCalled()
    })

    it('should propagate update errors without auditing', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(fakeTemplate()))
      mockedTemplateRepo.update.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmProposalTemplateService.update('u1', 'ws1', 't1', {
          name: 'X',
        }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })
  })

  describe('remove()', () => {
    it('should deny a MEMBER (members cannot delete documents)', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmProposalTemplateService.remove('u1', 'ws1', 't1'),
        'FORBIDDEN',
      )
      expect(mockedTemplateRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should soft delete for an ADMIN and audit', async () => {
      asRole('ADMIN')
      mockedTemplateRepo.findById.mockResolvedValue(ok(fakeTemplate()))
      mockedTemplateRepo.softDelete.mockResolvedValue(ok(undefined as never))
      expectOk(await CrmProposalTemplateService.remove('u1', 'ws1', 't1'))
      expect(mockedTemplateRepo.softDelete).toHaveBeenCalledWith('t1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 't1' }),
      )
    })

    it('should return NOT_FOUND when the template does not exist', async () => {
      asRole('OWNER')
      mockedTemplateRepo.findById.mockResolvedValue(err(notFound('Template')))
      expectErr(
        await CrmProposalTemplateService.remove('u1', 'ws1', 't1'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should propagate soft delete errors', async () => {
      asRole('OWNER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(fakeTemplate()))
      mockedTemplateRepo.softDelete.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmProposalTemplateService.remove('u1', 'ws1', 't1'),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })
  })

  describe('createFromProposal()', () => {
    it('should map proposal sections into template defaultContent', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.create.mockResolvedValue(
        ok(fakeTemplate({ name: 'Proposta X' })),
      )

      await CrmProposalTemplateService.createFromProposal('u1', 'ws1', {
        name: 'Proposta X',
        sections: [
          {
            id: 's1',
            type: 'COVER',
            order: 0,
            enabled: true,
            content: { type: 'COVER', title: 'Proposta X' },
          },
        ],
      })

      expect(mockedTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: [
            expect.objectContaining({
              type: 'COVER',
              defaultContent: { type: 'COVER', title: 'Proposta X' },
            }),
          ],
        }),
      )
    })
  })
})
