import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmOpportunity,
  createFakeCrmOpportunityLineItem,
} from '@/src/__tests__/factories/crm-opportunity.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-opportunity.repository')

import {
  CrmOpportunityLineItemRepository,
  CrmOpportunityRepository,
} from '@/src/repositories/crm-opportunity.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  CrmOpportunityLineItemService,
  CrmOpportunityService,
} from '../crm-opportunity.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedOpportunityRepo = vi.mocked(CrmOpportunityRepository)
const mockedLineItemRepo = vi.mocked(CrmOpportunityLineItemRepository)

describe('CrmOpportunityService', () => {
  describe('list()', () => {
    it('should return opportunities for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedOpportunityRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmOpportunity({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmOpportunityService.list('u1', 'ws1', {}))
      expect(dtos).toHaveLength(1)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await CrmOpportunityService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })
  })
})

describe('CrmOpportunityLineItemService', () => {
  describe('create()', () => {
    it('should create a line item when the opportunity exists', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedOpportunityRepo.findById.mockResolvedValue(
        ok(createFakeCrmOpportunity({ id: 'op1' })),
      )
      mockedLineItemRepo.create.mockResolvedValue(
        ok(createFakeCrmOpportunityLineItem({ name: 'Licença' })),
      )

      const dto = expectOk(
        await CrmOpportunityLineItemService.create('u1', 'ws1', 'op1', {
          name: 'Licença',
          quantity: 1,
          unitPrice: 0,
          discountPct: 0,
          billingType: 'ONE_TIME',
        }),
      )
      expect(dto.name).toBe('Licença')
    })
  })
})
