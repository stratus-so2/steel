import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmLead,
  createFakeCrmLeadContactAttempt,
  createFakeCrmLeadMeeting,
  createFakeCrmLeadProposalPresentation,
  createFakeCrmLeadQualification,
} from '@/src/__tests__/factories/crm-lead.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-lead.repository')
vi.mock('@/src/repositories/crm-lead-scoring-rule.repository')
vi.mock('@/src/repositories/crm-lead-routing-rule.repository')
vi.mock('@/src/repositories/crm-person.repository')
vi.mock('@/src/repositories/crm-proposal.repository')

import { createFakeCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import { createFakeCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { CrmLeadRoutingRuleRepository } from '@/src/repositories/crm-lead-routing-rule.repository'
import { CrmLeadScoringRuleRepository } from '@/src/repositories/crm-lead-scoring-rule.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { CrmProposalRepository } from '@/src/repositories/crm-proposal.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmLeadService } from '../crm-lead.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedLeadRepo = vi.mocked(CrmLeadRepository)
const mockedScoringRepo = vi.mocked(CrmLeadScoringRuleRepository)
const mockedRoutingRepo = vi.mocked(CrmLeadRoutingRuleRepository)
const mockedPersonRepo = vi.mocked(CrmPersonRepository)
const mockedProposalRepo = vi.mocked(CrmProposalRepository)

function mockMember() {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
}

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
        ok(createFakeCrmLead({ id: 'l1', stage: 'QUALIFIED' })),
      )
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedLeadRepo.update.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', convertedPersonId: 'p1' })),
      )

      const dto = expectOk(await CrmLeadService.convert('u1', 'ws1', 'l1'))
      expect(dto.id).toBe('p1')
      expect(mockedLeadRepo.update).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          convertedPersonId: 'p1',
        }),
      )
    })

    it('should reject converting an already converted lead', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', convertedPersonId: 'p0' })),
      )

      expectErr(
        await CrmLeadService.convert('u1', 'ws1', 'l1'),
        'CRM_LEAD_ALREADY_CONVERTED',
      )
    })
  })

  describe('registerContactAttempt()', () => {
    it('should advance RECEIVED -> IN_CONTACT on the first attempt', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'RECEIVED' })),
      )
      mockedLeadRepo.createContactAttempt.mockResolvedValue(
        ok(createFakeCrmLeadContactAttempt({ leadId: 'l1' })),
      )
      mockedLeadRepo.update.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'IN_CONTACT' })),
      )

      const result = expectOk(
        await CrmLeadService.registerContactAttempt('u1', 'ws1', 'l1', {
          contactedWith: 'Maria',
          channel: 'PHONE',
          outcome: 'ATTEMPTED',
          occurredAt: new Date(),
        }),
      )
      expect(result.lead.stage).toBe('IN_CONTACT')
      expect(mockedLeadRepo.update).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ stage: 'IN_CONTACT' }),
      )
    })

    it('should advance IN_CONTACT -> QUALIFIED only when outcome is REACHED', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'IN_CONTACT' })),
      )
      mockedLeadRepo.createContactAttempt.mockResolvedValue(
        ok(
          createFakeCrmLeadContactAttempt({
            leadId: 'l1',
            outcome: 'ATTEMPTED',
          }),
        ),
      )

      const result = expectOk(
        await CrmLeadService.registerContactAttempt('u1', 'ws1', 'l1', {
          contactedWith: 'Maria',
          channel: 'PHONE',
          outcome: 'ATTEMPTED',
          occurredAt: new Date(),
        }),
      )
      expect(result.lead.stage).toBe('IN_CONTACT')
      expect(mockedLeadRepo.update).not.toHaveBeenCalled()
    })

    it('should reject registering an attempt on a closed lead', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'CLOSED' })),
      )

      expectErr(
        await CrmLeadService.registerContactAttempt('u1', 'ws1', 'l1', {
          contactedWith: 'Maria',
          channel: 'PHONE',
          outcome: 'ATTEMPTED',
          occurredAt: new Date(),
        }),
        'CRM_LEAD_ALREADY_CLOSED',
      )
    })
  })

  describe('upsertQualification()', () => {
    it('should advance QUALIFIED -> OPPORTUNITY on first save', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'QUALIFIED' })),
      )
      mockedLeadRepo.findQualification.mockResolvedValue(ok(null))
      mockedLeadRepo.upsertQualification.mockResolvedValue(
        ok(createFakeCrmLeadQualification({ leadId: 'l1' })),
      )
      mockedLeadRepo.update.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'OPPORTUNITY' })),
      )

      const result = expectOk(
        await CrmLeadService.upsertQualification('u1', 'ws1', 'l1', {
          decisionMakerName: 'Carlos',
          decisionMakerRole: 'CTO',
        }),
      )
      expect(result.lead.stage).toBe('OPPORTUNITY')
    })

    it('should reject qualifying a lead still in IN_CONTACT', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'IN_CONTACT' })),
      )
      mockedLeadRepo.findQualification.mockResolvedValue(ok(null))

      expectErr(
        await CrmLeadService.upsertQualification('u1', 'ws1', 'l1', {
          decisionMakerName: 'Carlos',
          decisionMakerRole: 'CTO',
        }),
        'CRM_LEAD_STAGE_TRANSITION_INVALID',
      )
    })
  })

  describe('registerMeeting()', () => {
    it('should reject registering a meeting outside OPPORTUNITY', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'QUALIFIED' })),
      )

      expectErr(
        await CrmLeadService.registerMeeting('u1', 'ws1', 'l1', {
          scheduledAt: new Date(),
          format: 'ONLINE',
          interestDetails: 'x',
          identifiedNeed: 'y',
        }),
        'CRM_LEAD_STAGE_TRANSITION_INVALID',
      )
    })

    it('should register a meeting without changing the stage', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'OPPORTUNITY' })),
      )
      mockedLeadRepo.createMeeting.mockResolvedValue(
        ok(createFakeCrmLeadMeeting({ leadId: 'l1' })),
      )

      const result = expectOk(
        await CrmLeadService.registerMeeting('u1', 'ws1', 'l1', {
          scheduledAt: new Date(),
          format: 'ONLINE',
          interestDetails: 'x',
          identifiedNeed: 'y',
        }),
      )
      expect(result.lead.stage).toBe('OPPORTUNITY')
      expect(mockedLeadRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('createProposal()', () => {
    it('should advance OPPORTUNITY -> PROPOSAL when a meeting exists', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'OPPORTUNITY' })),
      )
      mockedLeadRepo.listMeetings.mockResolvedValue(
        ok([createFakeCrmLeadMeeting({ leadId: 'l1' })]),
      )
      mockedProposalRepo.create.mockResolvedValue(
        ok({
          ...createFakeCrmProposal({ id: 'p1', leadId: 'l1' }),
          sections: [],
        }),
      )
      mockedLeadRepo.update.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'PROPOSAL' })),
      )

      const result = expectOk(
        await CrmLeadService.createProposal('u1', 'ws1', 'l1', {
          name: 'Proposta X',
        }),
      )
      expect(result.lead.stage).toBe('PROPOSAL')
      expect(result.proposal.id).toBe('p1')
    })

    it('should reject creating a proposal with no meeting registered', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'OPPORTUNITY' })),
      )
      mockedLeadRepo.listMeetings.mockResolvedValue(ok([]))

      expectErr(
        await CrmLeadService.createProposal('u1', 'ws1', 'l1', {
          name: 'Proposta X',
        }),
        'CRM_LEAD_STAGE_REQUIREMENTS_NOT_MET',
      )
    })
  })

  describe('registerProposalPresentation()', () => {
    it('should register a presentation for the lead proposal', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'PROPOSAL' })),
      )
      mockedProposalRepo.findById.mockResolvedValue(
        ok({
          ...createFakeCrmProposal({ id: 'p1', leadId: 'l1' }),
          sections: [],
        }),
      )
      mockedLeadRepo.createProposalPresentation.mockResolvedValue(
        ok(
          createFakeCrmLeadProposalPresentation({
            leadId: 'l1',
            proposalId: 'p1',
          }),
        ),
      )

      const result = expectOk(
        await CrmLeadService.registerProposalPresentation(
          'u1',
          'ws1',
          'l1',
          'p1',
          {
            presentedAt: new Date(),
            format: 'ONLINE',
            amount: 1500,
            interestLevel: 'HIGH',
            interactionsCount: 2,
          },
        ),
      )
      expect(result.presentation.leadId).toBe('l1')
    })

    it('should reject a proposal that belongs to another lead', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'PROPOSAL' })),
      )
      mockedProposalRepo.findById.mockResolvedValue(
        ok({
          ...createFakeCrmProposal({ id: 'p1', leadId: 'other-lead' }),
          sections: [],
        }),
      )

      expectErr(
        await CrmLeadService.registerProposalPresentation(
          'u1',
          'ws1',
          'l1',
          'p1',
          {
            presentedAt: new Date(),
            format: 'ONLINE',
            amount: 1500,
            interestLevel: 'HIGH',
            interactionsCount: 2,
          },
        ),
        'CRM_LEAD_PROPOSAL_NOT_FOUND',
      )
    })
  })

  describe('closeWon()', () => {
    it('should convert the lead to a person when a presentation exists', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'PROPOSAL' })),
      )
      mockedLeadRepo.listProposalPresentations.mockResolvedValue(
        ok([createFakeCrmLeadProposalPresentation({ leadId: 'l1' })]),
      )
      mockedPersonRepo.create.mockResolvedValue(
        ok(createFakeCrmPerson({ id: 'p1' })),
      )
      mockedLeadRepo.update.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'CLOSED' })),
      )

      const dto = expectOk(
        await CrmLeadService.closeWon('u1', 'ws1', 'l1', {
          contractSignedAt: new Date(),
          billingType: 'MONTHLY',
          closedAmount: 1500,
          contractSignedConfirmed: true,
        }),
      )
      expect(dto.id).toBe('p1')
      expect(mockedLeadRepo.update).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ stage: 'CLOSED', closeResult: 'WON' }),
      )
    })

    it('should reject closing won without a proposal presentation', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'PROPOSAL' })),
      )
      mockedLeadRepo.listProposalPresentations.mockResolvedValue(ok([]))

      expectErr(
        await CrmLeadService.closeWon('u1', 'ws1', 'l1', {
          contractSignedAt: new Date(),
          billingType: 'MONTHLY',
          closedAmount: 1500,
          contractSignedConfirmed: true,
        }),
        'CRM_LEAD_STAGE_REQUIREMENTS_NOT_MET',
      )
    })

    it('should reject closing won from a stage before PROPOSAL', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'OPPORTUNITY' })),
      )

      expectErr(
        await CrmLeadService.closeWon('u1', 'ws1', 'l1', {
          contractSignedAt: new Date(),
          billingType: 'MONTHLY',
          closedAmount: 1500,
          contractSignedConfirmed: true,
        }),
        'CRM_LEAD_STAGE_TRANSITION_INVALID',
      )
    })
  })

  describe('closeLost()', () => {
    it('should close an early-stage lead as lost without a presentation', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'IN_CONTACT' })),
      )
      mockedLeadRepo.update.mockResolvedValue(
        ok(
          createFakeCrmLead({
            id: 'l1',
            stage: 'CLOSED',
            closeResult: 'LOST',
          }),
        ),
      )

      const dto = expectOk(
        await CrmLeadService.closeLost('u1', 'ws1', 'l1', {
          lostReason: 'Sem resposta',
        }),
      )
      expect(dto.closeResult).toBe('LOST')
    })

    it('should reject closing an already closed lead', async () => {
      mockMember()
      mockedLeadRepo.findById.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'l1', stage: 'CLOSED' })),
      )

      expectErr(
        await CrmLeadService.closeLost('u1', 'ws1', 'l1', {
          lostReason: 'Sem resposta',
        }),
        'CRM_LEAD_ALREADY_CLOSED',
      )
    })
  })
})
