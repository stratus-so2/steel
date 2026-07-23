import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmActivity } from '@/src/__tests__/factories/crm-activity.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-activity.repository')

import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmActivityService } from '../crm-activity.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedActivityRepo = vi.mocked(CrmActivityRepository)

describe('CrmActivityService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmActivityService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return activities for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedActivityRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmActivity({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmActivityService.list('u1', 'ws1', {}))
      expect(dtos).toHaveLength(1)
    })
  })
})
