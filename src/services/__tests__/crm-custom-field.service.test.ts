import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmCustomFieldDefinition } from '@/src/__tests__/factories/crm-custom-field.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

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
  })
})
