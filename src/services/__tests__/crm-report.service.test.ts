import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmReport } from '@/src/__tests__/factories/crm-report.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-report.repository')
vi.mock('@/src/services/crm-company.service')
vi.mock('@/src/services/crm-opportunity.service')

import { CrmReportRepository } from '@/src/repositories/crm-report.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmCompanyService } from '@/src/services/crm-company.service'
import { CrmOpportunityService } from '@/src/services/crm-opportunity.service'
import { CrmReportService } from '../crm-report.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedReportRepo = vi.mocked(CrmReportRepository)
const mockedCompanyService = vi.mocked(CrmCompanyService)
const mockedOpportunityService = vi.mocked(CrmOpportunityService)

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

  describe('getById()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmReportService.getById('u1', 'ws1', 'r1'), 'FORBIDDEN')
    })
  })

  describe('runData()', () => {
    it('should fetch rows for a legacy (source-only) report via the entity service', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedReportRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmReport({
            id: 'r1',
            source: 'company',
            columns: ['name'],
            query: null,
          }),
        ),
      )
      mockedCompanyService.list.mockResolvedValue(
        ok([{ id: 'c1', name: 'Acme' } as never]),
      )

      const data = expectOk(await CrmReportService.runData('u1', 'ws1', 'r1'))
      expect(data.rows).toEqual([{ 'company.name': 'Acme' }])
      expect(mockedCompanyService.list).toHaveBeenCalledWith('u1', 'ws1', {
        icp: undefined,
      })
    })

    it('should join two datasets by fetching each source once', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedReportRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmReport({
            id: 'r1',
            query: {
              mode: 'join',
              datasets: [
                { alias: 'opportunity', source: 'opportunity', filters: [] },
                { alias: 'company', source: 'company', filters: [] },
              ],
              joins: [
                {
                  leftAlias: 'opportunity',
                  rightAlias: 'company',
                  leftField: 'companyId',
                  rightField: 'id',
                  type: 'left',
                },
              ],
              columns: ['opportunity.name', 'company.name'],
            },
          }),
        ),
      )
      mockedOpportunityService.list.mockResolvedValue(
        ok([{ id: 'o1', name: 'Acme deal', companyId: 'c1' } as never]),
      )
      mockedCompanyService.list.mockResolvedValue(
        ok([{ id: 'c1', name: 'Acme' } as never]),
      )

      const data = expectOk(await CrmReportService.runData('u1', 'ws1', 'r1'))
      expect(data.rows).toEqual([
        { 'opportunity.name': 'Acme deal', 'company.name': 'Acme' },
      ])
      expect(mockedOpportunityService.list).toHaveBeenCalledTimes(1)
      expect(mockedCompanyService.list).toHaveBeenCalledTimes(1)
    })
  })
})
