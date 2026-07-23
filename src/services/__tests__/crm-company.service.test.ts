import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmCompany } from '@/src/__tests__/factories/crm-company.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-company.repository')
vi.mock('@/src/repositories/crm-activity.repository')
vi.mock('@/src/repositories/crm-custom-field.repository')

import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import { CrmCompanyRepository } from '@/src/repositories/crm-company.repository'
import {
  CrmCustomFieldDefinitionRepository,
  CrmCustomFieldValueRepository,
} from '@/src/repositories/crm-custom-field.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmCompanyService } from '../crm-company.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedCompanyRepo = vi.mocked(CrmCompanyRepository)
const mockedActivityRepo = vi.mocked(CrmActivityRepository)
const mockedCustomFieldValueRepo = vi.mocked(CrmCustomFieldValueRepository)
const mockedCustomFieldDefRepo = vi.mocked(CrmCustomFieldDefinitionRepository)

mockedCustomFieldValueRepo.listByRecords.mockResolvedValue(ok([]))

describe('CrmCompanyService', () => {
  describe('list()', () => {
    it('should return companies for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompanyRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmCompany({ workspaceId: 'ws1' })]),
      )

      const result = await CrmCompanyService.list('u1', 'ws1', {
        icp: undefined,
      })

      const dtos = expectOk(result)
      expect(dtos).toHaveLength(1)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await CrmCompanyService.list('u1', 'ws1', {
        icp: undefined,
      })

      expectErr(result, 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should create a company for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompanyRepo.create.mockResolvedValue(
        ok(createFakeCrmCompany({ name: 'Acme' })),
      )

      const result = await CrmCompanyService.create('u1', 'ws1', {
        name: 'Acme',
        icp: false,
      })

      const dto = expectOk(result)
      expect(dto.name).toBe('Acme')
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'company', action: 'CREATED' }),
      )
    })

    it('should apply custom field values when provided', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const created = createFakeCrmCompany({ id: 'c1', name: 'Acme' })
      mockedCompanyRepo.create.mockResolvedValue(ok(created))
      mockedCustomFieldDefRepo.listByWorkspace.mockResolvedValue(
        ok([
          {
            id: 'def1',
            workspaceId: 'ws1',
            entity: 'COMPANY',
            key: 'segment',
            label: 'Segmento',
            type: 'TEXT',
            options: [],
            required: false,
            position: 0,
            createdById: 'u1',
            updatedById: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ]),
      )
      mockedCustomFieldValueRepo.applyForRecord.mockResolvedValue(ok(undefined))

      const dto = expectOk(
        await CrmCompanyService.create('u1', 'ws1', {
          name: 'Acme',
          icp: false,
          customFields: { def1: 'Enterprise' },
        }),
      )
      expect(dto.name).toBe('Acme')
      expect(mockedCustomFieldValueRepo.applyForRecord).toHaveBeenCalledWith([
        { definitionId: 'def1', recordId: 'c1', value: 'Enterprise' },
      ])
    })

    it('should propagate repository errors', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompanyRepo.create.mockResolvedValue(err(databaseError()))

      const result = await CrmCompanyService.create('u1', 'ws1', {
        name: 'Acme',
        icp: false,
      })

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('remove()', () => {
    it('should soft delete an existing company', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedCompanyRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompany({ id: 'c1' })),
      )
      mockedCompanyRepo.softDelete.mockResolvedValue(ok(undefined))

      const result = await CrmCompanyService.remove('u1', 'ws1', 'c1')

      expectOk(result)
      expect(mockedCompanyRepo.softDelete).toHaveBeenCalledWith('c1')
    })
  })
})
