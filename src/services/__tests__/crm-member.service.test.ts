import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmMemberService } from '../crm-member.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)

describe('CrmMemberService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await CrmMemberService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should map memberships to member DTOs', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
        ok([
          {
            ...createFakeMembership({ userId: 'u1', workspaceId: 'ws1' }),
            user: {
              id: 'u1',
              name: 'Jane',
              email: 'jane@acme.com',
              image: null,
            },
          },
        ]),
      )

      const dtos = expectOk(await CrmMemberService.list('u1', 'ws1'))
      expect(dtos).toEqual([
        { id: 'u1', name: 'Jane', email: 'jane@acme.com', image: null },
      ])
    })
    it('should let a viewer list members (no resource permission required)', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'VIEWER' })),
      )
      mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(ok([]))

      expect(expectOk(await CrmMemberService.list('u1', 'ws1'))).toEqual([])
    })

    it('should return MODULE_DISABLED when the CRM module is off', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))

      expectErr(await CrmMemberService.list('u1', 'ws1'), 'MODULE_DISABLED')
      expect(
        mockedMembershipRepo.listWithUserByWorkspace,
      ).not.toHaveBeenCalled()
    })

    it('should propagate repository errors', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
        err(databaseError()),
      )

      expectErr(await CrmMemberService.list('u1', 'ws1'), 'DATABASE_ERROR')
    })
  })
})
