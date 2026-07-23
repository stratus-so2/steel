import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmMemberService } from '../crm-member.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)

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
  })
})
