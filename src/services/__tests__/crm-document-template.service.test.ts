import { describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-document-template.repository')

import { CrmDocumentTemplateRepository } from '@/src/repositories/crm-document-template.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmDocumentTemplateService } from '../crm-document-template.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedTemplateRepo = vi.mocked(CrmDocumentTemplateRepository)

type FakeTemplate = {
  id: string
  title: string
  content: string
  contentJson: string | null
  type: 'PREMISES' | 'PORTFOLIO' | 'PROPOSAL' | 'CONTRACT'
  workspaceId: string
  createdById: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

function fakeTemplate(overrides?: Partial<FakeTemplate>): FakeTemplate {
  return {
    id: 't1',
    title: 'Template X',
    content: '<p>oi</p>',
    contentJson: null,
    type: 'PROPOSAL',
    workspaceId: 'ws1',
    createdById: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

describe('CrmDocumentTemplateService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmDocumentTemplateService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should map repository rows to DTOs', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedTemplateRepo.listByWorkspace.mockResolvedValue(ok([fakeTemplate()]))

      const dtos = expectOk(await CrmDocumentTemplateService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
      expect(dtos[0]?.id).toBe('t1')
    })
  })

  describe('create()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmDocumentTemplateService.create('u1', 'ws1', {
          title: 'Template X',
          content: '',
          type: 'PROPOSAL',
        }),
        'FORBIDDEN',
      )
    })

    it('should create a template scoped to the workspace/actor', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedTemplateRepo.create.mockResolvedValue(ok(fakeTemplate()))

      const dto = expectOk(
        await CrmDocumentTemplateService.create('u1', 'ws1', {
          title: 'Template X',
          content: '<p>oi</p>',
          type: 'PROPOSAL',
        }),
      )
      expect(dto.id).toBe('t1')
      expect(mockedTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          title: 'Template X',
        }),
      )
    })
  })

  describe('remove()', () => {
    it('should soft-delete an existing template', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedTemplateRepo.findById.mockResolvedValue(ok(fakeTemplate()))
      mockedTemplateRepo.softDelete.mockResolvedValue(ok(undefined))

      expectOk(await CrmDocumentTemplateService.remove('u1', 'ws1', 't1'))
      expect(mockedTemplateRepo.softDelete).toHaveBeenCalledWith('t1')
    })

    it('should propagate RESOURCE_NOT_FOUND from a missing template', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedTemplateRepo.findById.mockResolvedValue(
        err({ code: 'RESOURCE_NOT_FOUND', message: 'not found' } as never),
      )

      expectErr(
        await CrmDocumentTemplateService.remove('u1', 'ws1', 'missing'),
        'RESOURCE_NOT_FOUND',
      )
    })
  })
})
