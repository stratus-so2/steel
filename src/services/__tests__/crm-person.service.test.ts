import type { CrmCustomFieldDefinition, Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-person.repository')
vi.mock('@/src/repositories/crm-activity.repository')
vi.mock('@/src/repositories/crm-custom-field.repository')
vi.mock('../crm-workflow-dispatcher', () => ({
  dispatchCrmWorkflowRecordEvent: vi.fn(async () => undefined),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import {
  CrmCustomFieldDefinitionRepository,
  CrmCustomFieldValueRepository,
} from '@/src/repositories/crm-custom-field.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmPersonService } from '../crm-person.service'
import { dispatchCrmWorkflowRecordEvent } from '../crm-workflow-dispatcher'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedPersonRepo = vi.mocked(CrmPersonRepository)
const mockedCustomFieldValueRepo = vi.mocked(CrmCustomFieldValueRepository)
const mockedCustomFieldDefRepo = vi.mocked(CrmCustomFieldDefinitionRepository)
const mockedActivityRepo = vi.mocked(CrmActivityRepository)
const mockedDispatch = vi.mocked(dispatchCrmWorkflowRecordEvent)
const mockedAudit = vi.mocked(auditMutation)

function asRole(role: Role) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

function textDefinition(
  overrides?: Partial<CrmCustomFieldDefinition>,
): CrmCustomFieldDefinition {
  return {
    id: 'def1',
    workspaceId: 'ws1',
    entity: 'PERSON',
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
    ...overrides,
  }
}

const createDto = { name: 'Jane', emails: [], phones: [] }

beforeEach(() => {
  mockedCustomFieldValueRepo.listByRecords.mockResolvedValue(ok([]))
  mockedCustomFieldValueRepo.applyForRecord.mockResolvedValue(ok(undefined))
  mockedCustomFieldDefRepo.listByWorkspace.mockResolvedValue(
    ok([textDefinition()]),
  )
})

describe('CrmPersonService', () => {
  describe('permission matrix (people)', () => {
    it.each([
      ['VIEWER', 'create'],
      ['VIEWER', 'update'],
      ['VIEWER', 'remove'],
      ['VIEWER', 'reorder'],
      ['MEMBER', 'remove'],
    ] as const)('should forbid a %s from calling %s()', async (role, action) => {
      asRole(role)

      const result =
        action === 'create'
          ? await CrmPersonService.create('u1', 'ws1', createDto)
          : action === 'update'
            ? await CrmPersonService.update('u1', 'ws1', 'p1', { name: 'X' })
            : action === 'remove'
              ? await CrmPersonService.remove('u1', 'ws1', 'p1')
              : await CrmPersonService.reorder('u1', 'ws1', ['p1'])

      expectErr(result, 'FORBIDDEN')
      expect(mockedPersonRepo.findById).not.toHaveBeenCalled()
      expect(mockedPersonRepo.create).not.toHaveBeenCalled()
      expect(mockedPersonRepo.reorder).not.toHaveBeenCalled()
    })

    it('should let a VIEWER read people', async () => {
      asRole('VIEWER')
      mockedPersonRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmPerson()]),
      )

      expect(
        expectOk(await CrmPersonService.list('u1', 'ws1', {})),
      ).toHaveLength(1)
    })

    it('should return MODULE_DISABLED when the CRM is off', async () => {
      asRole('OWNER')
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))

      expectErr(await CrmPersonService.list('u1', 'ws1', {}), 'MODULE_DISABLED')
      expect(mockedPersonRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should return WORKSPACE_SUSPENDED for a suspended workspace', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(
          createFakeMembership({ role: 'OWNER', workspaceStatus: 'SUSPENDED' }),
        ),
      )

      expectErr(
        await CrmPersonService.getById('u1', 'ws1', 'p1'),
        'WORKSPACE_SUSPENDED',
      )
    })
  })

  describe('list()', () => {
    it('should return people with their custom fields, filtered by company', async () => {
      asRole('MEMBER')
      mockedPersonRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmPerson({ id: 'p1', workspaceId: 'ws1' })]),
      )
      mockedCustomFieldValueRepo.listByRecords.mockResolvedValue(
        ok([{ recordId: 'p1', definitionId: 'def1', value: 'VIP' }] as never),
      )

      const dtos = expectOk(
        await CrmPersonService.list('u1', 'ws1', { companyId: 'c1' }),
      )

      expect(dtos).toHaveLength(1)
      expect(dtos[0].customFields).toEqual({ cf_def1: 'VIP' })
      expect(mockedPersonRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
        companyId: 'c1',
      })
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await CrmPersonService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedPersonRepo.listByWorkspace.mockResolvedValue(err(databaseError()))

      expectErr(await CrmPersonService.list('u1', 'ws1', {}), 'DATABASE_ERROR')
    })
  })

  describe('getById()', () => {
    it('should return the person with custom fields', async () => {
      asRole('VIEWER')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1', name: 'Jane' })),
      )

      const dto = expectOk(await CrmPersonService.getById('u1', 'ws1', 'p1'))

      expect(dto.name).toBe('Jane')
      expect(dto.customFields).toEqual({})
      expect(mockedPersonRepo.findById).toHaveBeenCalledWith('p1', 'ws1')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await CrmPersonService.getById('u1', 'ws1', 'p1'), 'FORBIDDEN')
    })

    it('should propagate NOT_FOUND', async () => {
      asRole('MEMBER')
      mockedPersonRepo.findById.mockResolvedValue(err(notFound('Person')))

      expectErr(
        await CrmPersonService.getById('u1', 'ws1', 'p1'),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('create()', () => {
    it('should create a person, record activity and dispatch workflows', async () => {
      asRole('MEMBER')
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1', name: 'Jane' })),
      )

      const dto = expectOk(
        await CrmPersonService.create('u1', 'ws1', {
          ...createDto,
          companyId: 'c1',
        }),
      )

      expect(dto.name).toBe('Jane')
      expect(mockedPersonRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          companyId: 'c1',
        }),
      )
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'person', action: 'CREATED' }),
      )
      expect(mockedDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'person', event: 'created' }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', targetId: 'p1' }),
      )
      expect(mockedCustomFieldValueRepo.applyForRecord).not.toHaveBeenCalled()
    })

    it('should apply custom field values when provided', async () => {
      asRole('MEMBER')
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )

      expectOk(
        await CrmPersonService.create('u1', 'ws1', {
          ...createDto,
          customFields: { def1: 'Enterprise' },
        }),
      )

      expect(mockedCustomFieldDefRepo.listByWorkspace).toHaveBeenCalledWith(
        'ws1',
        { entity: 'PERSON' },
      )
      expect(mockedCustomFieldValueRepo.applyForRecord).toHaveBeenCalledWith([
        { definitionId: 'def1', recordId: 'p1', value: 'Enterprise' },
      ])
    })

    it('should return the custom field error without recording activity', async () => {
      asRole('MEMBER')
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedCustomFieldDefRepo.listByWorkspace.mockResolvedValue(
        ok([textDefinition({ required: true })]),
      )

      expectErr(
        await CrmPersonService.create('u1', 'ws1', {
          ...createDto,
          customFields: { def1: '' },
        }),
        'CRM_CUSTOM_FIELD_INVALID',
      )
      expect(mockedActivityRepo.record).not.toHaveBeenCalled()
      expect(mockedDispatch).not.toHaveBeenCalled()
    })

    it('should propagate a failure loading custom field values', async () => {
      asRole('MEMBER')
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedCustomFieldValueRepo.listByRecords.mockResolvedValue(
        err(databaseError()),
      )

      expectErr(
        await CrmPersonService.create('u1', 'ws1', createDto),
        'DATABASE_ERROR',
      )
      expect(mockedDispatch).not.toHaveBeenCalled()
    })

    it('should audit and propagate repository errors', async () => {
      asRole('MEMBER')
      mockedPersonRepo.create.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmPersonService.create('u1', 'ws1', createDto),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })
  })

  describe('update()', () => {
    it('should update the person, record activity and dispatch workflows', async () => {
      asRole('MEMBER')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.update.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1', name: 'Novo' })),
      )

      const dto = expectOk(
        await CrmPersonService.update('u1', 'ws1', 'p1', {
          name: 'Novo',
          companyId: null,
        }),
      )

      expect(dto.name).toBe('Novo')
      expect(mockedPersonRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          name: 'Novo',
          companyId: null,
          updatedById: 'u1',
        }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['name', 'companyId'] },
        }),
      )
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'person', action: 'UPDATED' }),
      )
      expect(mockedDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'updated' }),
      )
    })

    it('should apply custom fields on update', async () => {
      asRole('MEMBER')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.update.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )

      expectOk(
        await CrmPersonService.update('u1', 'ws1', 'p1', {
          customFields: { def1: 'SMB' },
        }),
      )
      expect(mockedCustomFieldValueRepo.applyForRecord).toHaveBeenCalledWith([
        { definitionId: 'def1', recordId: 'p1', value: 'SMB' },
      ])
    })

    it('should propagate custom field errors on update', async () => {
      asRole('MEMBER')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.update.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedCustomFieldValueRepo.applyForRecord.mockResolvedValue(
        err(databaseError()),
      )

      expectErr(
        await CrmPersonService.update('u1', 'ws1', 'p1', {
          customFields: { def1: 'SMB' },
        }),
        'DATABASE_ERROR',
      )
      expect(mockedDispatch).not.toHaveBeenCalled()
    })

    it('should propagate a failure merging custom fields', async () => {
      asRole('MEMBER')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.update.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedCustomFieldValueRepo.listByRecords.mockResolvedValue(
        err(databaseError()),
      )

      expectErr(
        await CrmPersonService.update('u1', 'ws1', 'p1', { name: 'X' }),
        'DATABASE_ERROR',
      )
    })

    it('should return NOT_FOUND when the person does not exist', async () => {
      asRole('MEMBER')
      mockedPersonRepo.findById.mockResolvedValue(err(notFound('Person')))

      expectErr(
        await CrmPersonService.update('u1', 'ws1', 'p1', { name: 'X' }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedPersonRepo.update).not.toHaveBeenCalled()
    })

    it('should audit and propagate repository errors', async () => {
      asRole('MEMBER')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.update.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmPersonService.update('u1', 'ws1', 'p1', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          outcome: 'failure',
          targetId: 'p1',
        }),
      )
    })
  })

  describe('remove()', () => {
    it('should soft delete an existing person', async () => {
      asRole('ADMIN')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.softDelete.mockResolvedValue(ok(undefined))

      expectOk(await CrmPersonService.remove('u1', 'ws1', 'p1'))

      expect(mockedPersonRepo.softDelete).toHaveBeenCalledWith('p1')
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'person', action: 'DELETED' }),
      )
      expect(mockedDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'deleted' }),
      )
    })

    it('should return NOT_FOUND when the person does not exist', async () => {
      asRole('ADMIN')
      mockedPersonRepo.findById.mockResolvedValue(err(notFound('Person')))

      expectErr(
        await CrmPersonService.remove('u1', 'ws1', 'p1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedPersonRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should propagate soft delete errors', async () => {
      asRole('OWNER')
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.softDelete.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmPersonService.remove('u1', 'ws1', 'p1'),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })
  })

  describe('reorder()', () => {
    it('should delegate to the repository for a member', async () => {
      asRole('MEMBER')
      mockedPersonRepo.reorder.mockResolvedValue(ok(undefined))

      expectOk(await CrmPersonService.reorder('u1', 'ws1', ['p2', 'p1']))
      expect(mockedPersonRepo.reorder).toHaveBeenCalledWith('ws1', ['p2', 'p1'])
    })
  })
})
