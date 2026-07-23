import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-person.repository')

import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmPersonService } from '../crm-person.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedPersonRepo = vi.mocked(CrmPersonRepository)

describe('CrmPersonService', () => {
  describe('list()', () => {
    it('should return people for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedPersonRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmPerson({ workspaceId: 'ws1' })]),
      )

      const result = await CrmPersonService.list('u1', 'ws1', {})

      const dtos = expectOk(result)
      expect(dtos).toHaveLength(1)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await CrmPersonService.list('u1', 'ws1', {})

      expectErr(result, 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should create a person for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ name: 'Jane' })),
      )

      const result = await CrmPersonService.create('u1', 'ws1', {
        name: 'Jane',
        emails: [],
        phones: [],
      })

      const dto = expectOk(result)
      expect(dto.name).toBe('Jane')
    })

    it('should propagate repository errors', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedPersonRepo.create.mockResolvedValue(err(databaseError()))

      const result = await CrmPersonService.create('u1', 'ws1', {
        name: 'Jane',
        emails: [],
        phones: [],
      })

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('remove()', () => {
    it('should soft delete an existing person', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedPersonRepo.findById.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedPersonRepo.softDelete.mockResolvedValue(ok(undefined))

      const result = await CrmPersonService.remove('u1', 'ws1', 'p1')

      expectOk(result)
      expect(mockedPersonRepo.softDelete).toHaveBeenCalledWith('p1')
    })
  })
})
