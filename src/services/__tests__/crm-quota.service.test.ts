import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmQuota } from '@/src/__tests__/factories/crm-quota.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-quota.repository')

import { CrmQuotaRepository } from '@/src/repositories/crm-quota.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmQuotaService } from '../crm-quota.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedQuotaRepo = vi.mocked(CrmQuotaRepository)

describe('CrmQuotaService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a plain member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      expectErr(await CrmQuotaService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return quotas for a privileged member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuotaRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmQuota({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmQuotaService.list('u1', 'ws1', {}))
      expect(dtos).toHaveLength(1)
    })
  })
})
