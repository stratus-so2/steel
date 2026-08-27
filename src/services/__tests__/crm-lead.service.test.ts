import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmLead } from '@/src/__tests__/factories/crm-lead.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-lead.repository')
vi.mock('@/src/repositories/crm-lead-scoring-rule.repository')
vi.mock('@/src/repositories/crm-lead-routing-rule.repository')
vi.mock('@/src/repositories/crm-person.repository')

import { createFakeCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { CrmLeadRoutingRuleRepository } from '@/src/repositories/crm-lead-routing-rule.repository'
import { CrmLeadScoringRuleRepository } from '@/src/repositories/crm-lead-scoring-rule.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmLeadService } from '../crm-lead.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedLeadRepo = vi.mocked(CrmLeadRepository)
const mockedScoringRepo = vi.mocked(CrmLeadScoringRuleRepository)
const mockedRoutingRepo = vi.mocked(CrmLeadRoutingRuleRepository)
const mockedPersonRepo = vi.mocked(CrmPersonRepository)

describe('CrmLeadService', () => {
  describe('create()', () => {
    it('should compute score and owner from active rules', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedScoringRepo.listActiveByWorkspace.mockResolvedValue(
        ok([
          {
            id: 'r1',
            workspaceId: 'ws1',
            field: 'email',
            operator: 'is_not_empty',
            value: null,
            points: 10,
            active: true,
            position: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      )
      mockedRoutingRepo.listActiveByWorkspace.mockResolvedValue(ok([]))
      mockedLeadRepo.create.mockResolvedValue(
        ok(createFakeCrmLead({ score: 10, emails: ['a@b.com'] })),
      )

      const dto = expectOk(
        await CrmLeadService.create('u1', 'ws1', {
          name: 'Jane',
          emails: ['a@b.com'],
          phones: [],
          source: 'WhatsApp',
          status: 'NEW',
        }),
      )
      expect(dto.score).toBe(10)
      expect(mockedLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ score: 10 }),
      )
    })
  })

  describe('convert()', () => {
    it('should create a person and mark the lead as converted', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', status: 'QUALIFIED' })),
      )
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedLeadRepo.update.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', status: 'CONVERTED' })),
      )

      const dto = expectOk(await CrmLeadService.convert('u1', 'ws1', 'l1'))
      expect(dto.id).toBe('p1')
      expect(mockedLeadRepo.update).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          status: 'CONVERTED',
          convertedPersonId: 'p1',
        }),
      )
    })

    it('should reject converting an already converted lead', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', status: 'CONVERTED' })),
      )

      expectErr(
        await CrmLeadService.convert('u1', 'ws1', 'l1'),
        'CRM_LEAD_ALREADY_CONVERTED',
      )
    })
  })
})
