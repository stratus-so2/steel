import type { Profile } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmCustomFieldDefinition } from '@/src/__tests__/factories/crm-custom-field.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-custom-field.repository')

import { createFakeCrmCustomFieldValue } from '@/src/__tests__/factories/crm-custom-field.factory'
import {
  CrmCustomFieldDefinitionRepository,
  CrmCustomFieldValueRepository,
} from '@/src/repositories/crm-custom-field.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  CrmCustomFieldDefinitionService,
  CrmCustomFieldValueService,
} from '../crm-custom-field.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedDefinitionRepo = vi.mocked(CrmCustomFieldDefinitionRepository)
const mockedValueRepo = vi.mocked(CrmCustomFieldValueRepository)

describe('CrmCustomFieldDefinitionService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(
        await CrmCustomFieldDefinitionService.list('u1', 'ws1', {}),
        'FORBIDDEN',
      )
    })

    it('should return definitions for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedDefinitionRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmCustomFieldDefinition({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(
        await CrmCustomFieldDefinitionService.list('u1', 'ws1', {}),
      )
      expect(dtos).toHaveLength(1)
    })
  })
})

describe('CrmCustomFieldValueService', () => {
  describe('setValue()', () => {
    it('should upsert the value when the definition exists', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedDefinitionRepo.findById.mockResolvedValue(
        ok(createFakeCrmCustomFieldDefinition({ id: 'd1' })),
      )
      mockedValueRepo.upsert.mockResolvedValue(
        ok(createFakeCrmCustomFieldValue({ value: 'Enterprise' })),
      )

      const dto = expectOk(
        await CrmCustomFieldValueService.setValue(
          'u1',
          'ws1',
          'd1',
          'record-1',
          'Enterprise',
        ),
      )
      expect(dto.value).toBe('Enterprise')
    })

    it('should forbid a VIEWER from filling a custom field value', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'VIEWER' })),
      )
      mockedDefinitionRepo.findById.mockResolvedValue(
        ok(createFakeCrmCustomFieldDefinition({ id: 'd1' })),
      )

      expectErr(
        await CrmCustomFieldValueService.setValue(
          'u1',
          'ws1',
          'd1',
          'record-1',
          'Enterprise',
        ),
        'FORBIDDEN',
      )
      expect(mockedValueRepo.upsert).not.toHaveBeenCalled()
    })
  })
})

const dbError = () => err(databaseError('boom'))

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('CrmCustomFieldDefinitionService — mutations', () => {
  beforeEach(() => {
    asRole('ADMIN')
    mockedDefinitionRepo.findById.mockResolvedValue(
      ok(createFakeCrmCustomFieldDefinition({ id: 'd1', workspaceId: 'ws1' })),
    )
  })

  const input = {
    entity: 'COMPANY' as const,
    key: 'segment',
    label: 'Segmento',
    type: 'SELECT' as const,
    options: ['SMB', 'Enterprise'],
    required: false,
  }

  describe('list()', () => {
    it('forwards the entity filter to the repository', async () => {
      mockedDefinitionRepo.listByWorkspace.mockResolvedValue(ok([]))
      expectOk(
        await CrmCustomFieldDefinitionService.list('u1', 'ws1', {
          entity: 'PERSON',
        }),
      )
      expect(mockedDefinitionRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
        entity: 'PERSON',
      })
    })

    it('propagates repository errors', async () => {
      mockedDefinitionRepo.listByWorkspace.mockResolvedValue(dbError())
      expectErr(
        await CrmCustomFieldDefinitionService.list('u1', 'ws1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('creates the definition for an admin', async () => {
      mockedDefinitionRepo.create.mockResolvedValue(
        ok(createFakeCrmCustomFieldDefinition({ id: 'd-new', key: 'segment' })),
      )

      const dto = expectOk(
        await CrmCustomFieldDefinitionService.create('u1', 'ws1', input),
      )
      expect(dto.id).toBe('d-new')
      expect(mockedDefinitionRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        createdById: 'u1',
        ...input,
      })
    })

    it('returns FORBIDDEN for a MEMBER (custom fields are read-only)', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmCustomFieldDefinitionService.create('u1', 'ws1', input),
        'FORBIDDEN',
      )
      expect(mockedDefinitionRepo.create).not.toHaveBeenCalled()
    })

    it('propagates repository failures (e.g. duplicate key)', async () => {
      mockedDefinitionRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmCustomFieldDefinitionService.create('u1', 'ws1', input),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('updates the definition stamping the editor', async () => {
      mockedDefinitionRepo.update.mockResolvedValue(
        ok(createFakeCrmCustomFieldDefinition({ id: 'd1', label: 'Novo' })),
      )

      const dto = expectOk(
        await CrmCustomFieldDefinitionService.update('u1', 'ws1', 'd1', {
          label: 'Novo',
        }),
      )
      expect(dto.label).toBe('Novo')
      expect(mockedDefinitionRepo.update).toHaveBeenCalledWith('d1', {
        label: 'Novo',
        updatedById: 'u1',
      })
    })

    it('returns FORBIDDEN for a MEMBER', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmCustomFieldDefinitionService.update('u1', 'ws1', 'd1', {}),
        'FORBIDDEN',
      )
    })

    it('returns not found for a definition of another workspace', async () => {
      mockedDefinitionRepo.findById.mockResolvedValue(
        err(notFound('Custom field')),
      )
      expectErr(
        await CrmCustomFieldDefinitionService.update('u1', 'ws1', 'd1', {}),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedDefinitionRepo.update).not.toHaveBeenCalled()
    })

    it('propagates update failures', async () => {
      mockedDefinitionRepo.update.mockResolvedValue(dbError())
      expectErr(
        await CrmCustomFieldDefinitionService.update('u1', 'ws1', 'd1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('soft-deletes the definition', async () => {
      mockedDefinitionRepo.softDelete.mockResolvedValue(ok(undefined))
      expectOk(await CrmCustomFieldDefinitionService.remove('u1', 'ws1', 'd1'))
      expect(mockedDefinitionRepo.softDelete).toHaveBeenCalledWith('d1')
    })

    it('returns FORBIDDEN for a MEMBER', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmCustomFieldDefinitionService.remove('u1', 'ws1', 'd1'),
        'FORBIDDEN',
      )
    })

    it('returns not found for an unknown definition', async () => {
      mockedDefinitionRepo.findById.mockResolvedValue(
        err(notFound('Custom field')),
      )
      expectErr(
        await CrmCustomFieldDefinitionService.remove('u1', 'ws1', 'd1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedDefinitionRepo.softDelete).not.toHaveBeenCalled()
    })

    it('propagates delete failures', async () => {
      mockedDefinitionRepo.softDelete.mockResolvedValue(dbError())
      expectErr(
        await CrmCustomFieldDefinitionService.remove('u1', 'ws1', 'd1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('reorder()', () => {
    it('delegates the order to the repository', async () => {
      mockedDefinitionRepo.reorder.mockResolvedValue(ok(undefined))
      expectOk(
        await CrmCustomFieldDefinitionService.reorder('u1', 'ws1', ['b', 'a']),
      )
      expect(mockedDefinitionRepo.reorder).toHaveBeenCalledWith('ws1', [
        'b',
        'a',
      ])
    })

    it('returns FORBIDDEN for a MEMBER', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmCustomFieldDefinitionService.reorder('u1', 'ws1', []),
        'FORBIDDEN',
      )
      expect(mockedDefinitionRepo.reorder).not.toHaveBeenCalled()
    })
  })
})

describe('CrmCustomFieldValueService — edge cases', () => {
  beforeEach(() => {
    asRole('MEMBER')
    mockedDefinitionRepo.findById.mockResolvedValue(
      ok(createFakeCrmCustomFieldDefinition({ id: 'd1', entity: 'PERSON' })),
    )
  })

  describe('listByRecord()', () => {
    it('lists the values of a record', async () => {
      mockedValueRepo.listByRecord.mockResolvedValue(
        ok([createFakeCrmCustomFieldValue({ value: 'A' })]),
      )
      const dtos = expectOk(
        await CrmCustomFieldValueService.listByRecord('u1', 'ws1', 'rec-1'),
      )
      expect(dtos.map((d) => d.value)).toEqual(['A'])
      expect(mockedValueRepo.listByRecord).toHaveBeenCalledWith('rec-1')
    })

    it('returns FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCustomFieldValueService.listByRecord('u1', 'ws1', 'rec-1'),
        'FORBIDDEN',
      )
    })

    it('propagates repository errors', async () => {
      mockedValueRepo.listByRecord.mockResolvedValue(dbError())
      expectErr(
        await CrmCustomFieldValueService.listByRecord('u1', 'ws1', 'rec-1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('setValue()', () => {
    it('returns FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCustomFieldValueService.setValue('u1', 'ws1', 'd1', 'r', 1),
        'FORBIDDEN',
      )
    })

    it('returns not found for a definition of another workspace', async () => {
      mockedDefinitionRepo.findById.mockResolvedValue(
        err(notFound('Custom field')),
      )
      expectErr(
        await CrmCustomFieldValueService.setValue('u1', 'ws1', 'd1', 'r', 1),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedValueRepo.upsert).not.toHaveBeenCalled()
    })

    it('skips the entity permission check for privileged roles', async () => {
      asRole('OWNER')
      mockedValueRepo.upsert.mockResolvedValue(
        ok(createFakeCrmCustomFieldValue({ value: true })),
      )
      const dto = expectOk(
        await CrmCustomFieldValueService.setValue('u1', 'ws1', 'd1', 'r', true),
      )
      expect(dto.value).toBe(true)
      expect(mockedValueRepo.upsert).toHaveBeenCalledWith('d1', 'r', true)
    })

    it('denies a custom profile without any permission matrix', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(
          createFakeMembership({
            role: 'MEMBER',
            profile: {
              id: 'p1',
              workspaceId: 'ws1',
              name: 'Vazio',
              isSystem: false,
              systemKey: null,
              permissions: null,
            } as unknown as Profile,
          }),
        ),
      )
      expectErr(
        await CrmCustomFieldValueService.setValue('u1', 'ws1', 'd1', 'r', 1),
        'FORBIDDEN',
      )
    })

    it('propagates upsert failures', async () => {
      mockedValueRepo.upsert.mockResolvedValue(dbError())
      expectErr(
        await CrmCustomFieldValueService.setValue('u1', 'ws1', 'd1', 'r', null),
        'DATABASE_ERROR',
      )
    })
  })
})
