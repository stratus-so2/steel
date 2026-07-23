import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmReport } from '@/src/__tests__/factories/crm-report.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-report.repository')

import { CrmReportRepository } from '@/src/repositories/crm-report.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmReportService } from '../crm-report.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedReportRepo = vi.mocked(CrmReportRepository)

describe('CrmReportService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmReportService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return reports for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedReportRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmReport({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmReportService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })
  })

  describe('runData()', () => {
    it('should return CRM_REPORT_INVALID_SOURCE for an unsupported source', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedReportRepo.findById.mockResolvedValue(
        ok(createFakeCrmReport({ id: 'r1', source: 'invalid_source' })),
      )

      expectErr(
        await CrmReportService.runData('u1', 'ws1', 'r1'),
        'CRM_REPORT_INVALID_SOURCE',
      )
    })
  })
})
