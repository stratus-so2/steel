import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmDashboard } from '@/src/__tests__/factories/crm-dashboard.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-dashboard.repository')

import { CrmDashboardRepository } from '@/src/repositories/crm-dashboard.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmDashboardService } from '../crm-dashboard.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedDashboardRepo = vi.mocked(CrmDashboardRepository)

describe('CrmDashboardService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmDashboardService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return dashboards for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedDashboardRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmDashboard({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmDashboardService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })
  })
})
