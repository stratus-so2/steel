import { describe, expect, it } from 'vitest'
import { seedCrmLead } from '@/src/__tests__/factories/crm-lead.factory'
import { seedCrmProduct } from '@/src/__tests__/factories/crm-product.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmLeadRepository } from '../crm-lead.repository'

describe('CrmLeadRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmLead(workspace.id, user.id)

      const result = await CrmLeadRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Second',
        score: 0,
      })

      const lead = expectOk(result)
      expect(lead.position).toBe(1)
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by stage when provided', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const qualified = await seedCrmLead(workspace.id, user.id, {
        stage: 'QUALIFIED',
      })
      await seedCrmLead(workspace.id, user.id, { stage: 'RECEIVED' })

      const list = expectOk(
        await CrmLeadRepository.listByWorkspace(workspace.id, {
          stage: 'QUALIFIED',
        }),
      )
      expect(list.map((l) => l.id)).toEqual([qualified.id])
    })

    it('should exclude soft-deleted leads', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmLead(workspace.id, user.id)
      await seedCrmLead(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmLeadRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((l) => l.id)).toEqual([kept.id])
    })
  })

  describe('findById()', () => {
    it('should return RESOURCE_NOT_FOUND for another workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const seeded = await seedCrmLead(workspaceA.id, user.id)

      expectErr(
        await CrmLeadRepository.findById(seeded.id, workspaceB.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('createContactAttempt() / listContactAttempts()', () => {
    it('should list attempts newest first', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const lead = await seedCrmLead(workspace.id, user.id)

      const first = expectOk(
        await CrmLeadRepository.createContactAttempt({
          leadId: lead.id,
          workspaceId: workspace.id,
          createdById: user.id,
          contactedWith: 'Maria',
          channel: 'PHONE',
          outcome: 'ATTEMPTED',
          occurredAt: new Date('2026-01-01'),
        }),
      )
      const second = expectOk(
        await CrmLeadRepository.createContactAttempt({
          leadId: lead.id,
          workspaceId: workspace.id,
          createdById: user.id,
          contactedWith: 'Maria',
          channel: 'WHATSAPP',
          outcome: 'REACHED',
          occurredAt: new Date('2026-01-02'),
        }),
      )

      const list = expectOk(
        await CrmLeadRepository.listContactAttempts(lead.id),
      )
      expect(list.map((a) => a.id)).toEqual([second.id, first.id])
    })
  })

  describe('setInterestProducts()', () => {
    it('should replace the previous set of interest products', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const lead = await seedCrmLead(workspace.id, user.id)
      const [productA, productB] = await Promise.all([
        seedCrmProduct(workspace.id, user.id),
        seedCrmProduct(workspace.id, user.id),
      ])

      expectOk(
        await CrmLeadRepository.setInterestProducts(lead.id, [productA.id]),
      )
      expectOk(
        await CrmLeadRepository.setInterestProducts(lead.id, [productB.id]),
      )

      const remaining = await prisma.crmLeadInterestProduct.findMany({
        where: { leadId: lead.id },
      })
      expect(remaining.map((r) => r.productId)).toEqual([productB.id])
    })
  })

  describe('upsertQualification() / findQualification()', () => {
    it('should create then update the single qualification record', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const lead = await seedCrmLead(workspace.id, user.id)

      await CrmLeadRepository.upsertQualification({
        leadId: lead.id,
        qualifiedById: user.id,
        decisionMakerName: 'Carlos',
        decisionMakerRole: 'CTO',
      })
      await CrmLeadRepository.upsertQualification({
        leadId: lead.id,
        qualifiedById: user.id,
        decisionMakerName: 'Carla',
        decisionMakerRole: 'CEO',
      })

      const found = expectOk(await CrmLeadRepository.findQualification(lead.id))
      expect(found?.decisionMakerName).toBe('Carla')
    })

    it('should return null when no qualification exists yet', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const lead = await seedCrmLead(workspace.id, user.id)

      const found = expectOk(await CrmLeadRepository.findQualification(lead.id))
      expect(found).toBeNull()
    })
  })

  describe('createMeeting() / listMeetings()', () => {
    it('should list meetings for the lead', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const lead = await seedCrmLead(workspace.id, user.id)

      await CrmLeadRepository.createMeeting({
        leadId: lead.id,
        workspaceId: workspace.id,
        createdById: user.id,
        scheduledAt: new Date(),
        format: 'ONLINE',
        interestDetails: 'Quer automatizar o funil',
        identifiedNeed: 'Falta de visibilidade',
      })

      const list = expectOk(await CrmLeadRepository.listMeetings(lead.id))
      expect(list).toHaveLength(1)
    })
  })

  describe('createProposalPresentation() / listProposalPresentations()', () => {
    it('should list presentations for the lead', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const lead = await seedCrmLead(workspace.id, user.id)
      const proposal = await prisma.crmProposal.create({
        data: {
          name: 'Proposta X',
          leadId: lead.id,
          responsibleId: user.id,
          workspaceId: workspace.id,
          createdById: user.id,
          shareToken: `${lead.id}-token`,
        },
      })

      await CrmLeadRepository.createProposalPresentation({
        leadId: lead.id,
        proposalId: proposal.id,
        createdById: user.id,
        presentedAt: new Date(),
        format: 'ONLINE',
        amount: 1500,
        interestLevel: 'HIGH',
        interactionsCount: 3,
      })

      const list = expectOk(
        await CrmLeadRepository.listProposalPresentations(lead.id),
      )
      expect(list).toHaveLength(1)
      expect(Number(list[0]?.amount)).toBe(1500)
    })
  })
})
