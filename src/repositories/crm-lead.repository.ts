import type {
  CrmLead,
  CrmLeadContactAttempt,
  CrmLeadContactChannel,
  CrmLeadContactOutcome,
  CrmLeadMeeting,
  CrmLeadMeetingFormat,
  CrmLeadProposalFormat,
  CrmLeadProposalPresentation,
  CrmLeadQualification,
  CrmLeadStage,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmLeadRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: { stage?: CrmLeadStage },
  ): Promise<Result<CrmLead[]>> {
    try {
      const leads = await prisma.crmLead.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(filters?.stage ? { stage: filters.stage } : {}),
        },
        orderBy: { position: 'asc' },
      })
      return ok(leads)
    } catch (error) {
      return err(dbError('Failed to list CRM leads', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmLead>> {
    try {
      const lead = await prisma.crmLead.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!lead) return err(notFound('CrmLead'))
      return ok(lead)
    } catch (error) {
      return err(dbError('Failed to find CRM lead by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    emails?: string[]
    phones?: string[]
    company?: string
    jobTitle?: string
    city?: string
    linkedin?: string
    source?: string
    channel?: string
    score: number
    ownerId?: string | null
  }): Promise<Result<CrmLead>> {
    try {
      const position = await prisma.crmLead.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const lead = await prisma.crmLead.create({ data: { ...data, position } })
      return ok(lead)
    } catch (error) {
      return err(dbError('Failed to create CRM lead', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      emails?: string[]
      phones?: string[]
      company?: string
      jobTitle?: string
      city?: string
      linkedin?: string
      source?: string
      channel?: string
      stage?: CrmLeadStage
      score?: number
      ownerId?: string | null
      convertedPersonId?: string
      closeResult?: 'WON' | 'LOST'
      closedAt?: Date
      contractSignedAt?: Date
      billingType?: 'ONE_TIME' | 'MONTHLY' | 'YEARLY'
      closedAmount?: number
      lostReason?: string
      lostNote?: string
      retryAt?: Date
      updatedById?: string
    },
  ): Promise<Result<CrmLead>> {
    try {
      const lead = await prisma.crmLead.update({ where: { id }, data })
      return ok(lead)
    } catch (error) {
      return err(dbError('Failed to update CRM lead', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmLead.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM lead', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmLead.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM leads', error))
    }
  },

  // --- 01/02: tentativas e contatos efetivos ---

  async createContactAttempt(data: {
    leadId: string
    workspaceId: string
    createdById: string
    contactedWith: string
    channel: CrmLeadContactChannel
    outcome: CrmLeadContactOutcome
    occurredAt: Date
    note?: string
  }): Promise<Result<CrmLeadContactAttempt>> {
    try {
      const attempt = await prisma.crmLeadContactAttempt.create({ data })
      return ok(attempt)
    } catch (error) {
      return err(dbError('Failed to create CRM lead contact attempt', error))
    }
  },

  async listContactAttempts(
    leadId: string,
  ): Promise<Result<CrmLeadContactAttempt[]>> {
    try {
      const attempts = await prisma.crmLeadContactAttempt.findMany({
        where: { leadId },
        orderBy: { occurredAt: 'desc' },
      })
      return ok(attempts)
    } catch (error) {
      return err(dbError('Failed to list CRM lead contact attempts', error))
    }
  },

  // --- 02: produtos/serviços de interesse ---

  async setInterestProducts(
    leadId: string,
    productIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction([
        prisma.crmLeadInterestProduct.deleteMany({ where: { leadId } }),
        prisma.crmLeadInterestProduct.createMany({
          data: productIds.map((productId) => ({ leadId, productId })),
        }),
      ])
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to set CRM lead interest products', error))
    }
  },

  // --- 03: qualificação (único por lead) ---

  async upsertQualification(data: {
    leadId: string
    qualifiedById: string
    expectedCloseAt?: Date
    decisionMakerName: string
    decisionMakerRole: string
  }): Promise<Result<CrmLeadQualification>> {
    try {
      const qualification = await prisma.crmLeadQualification.upsert({
        where: { leadId: data.leadId },
        create: data,
        update: {
          qualifiedById: data.qualifiedById,
          expectedCloseAt: data.expectedCloseAt,
          decisionMakerName: data.decisionMakerName,
          decisionMakerRole: data.decisionMakerRole,
        },
      })
      return ok(qualification)
    } catch (error) {
      return err(dbError('Failed to upsert CRM lead qualification', error))
    }
  },

  async findQualification(
    leadId: string,
  ): Promise<Result<CrmLeadQualification | null>> {
    try {
      const qualification = await prisma.crmLeadQualification.findUnique({
        where: { leadId },
      })
      return ok(qualification)
    } catch (error) {
      return err(dbError('Failed to find CRM lead qualification', error))
    }
  },

  // --- 04: reuniões ---

  async createMeeting(data: {
    leadId: string
    workspaceId: string
    createdById: string
    scheduledAt: Date
    format: CrmLeadMeetingFormat
    contactPersonId?: string
    contactPersonName?: string
    interestDetails: string
    identifiedNeed: string
  }): Promise<Result<CrmLeadMeeting>> {
    try {
      const meeting = await prisma.crmLeadMeeting.create({ data })
      return ok(meeting)
    } catch (error) {
      return err(dbError('Failed to create CRM lead meeting', error))
    }
  },

  async listMeetings(leadId: string): Promise<Result<CrmLeadMeeting[]>> {
    try {
      const meetings = await prisma.crmLeadMeeting.findMany({
        where: { leadId },
        orderBy: { scheduledAt: 'desc' },
      })
      return ok(meetings)
    } catch (error) {
      return err(dbError('Failed to list CRM lead meetings', error))
    }
  },

  // --- 05: apresentações de proposta ---

  async createProposalPresentation(data: {
    leadId: string
    proposalId: string
    createdById: string
    presentedAt: Date
    format: CrmLeadProposalFormat
    amount: number
    interestLevel: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
    interactionsCount: number
  }): Promise<Result<CrmLeadProposalPresentation>> {
    try {
      const presentation = await prisma.crmLeadProposalPresentation.create({
        data,
      })
      return ok(presentation)
    } catch (error) {
      return err(
        dbError('Failed to create CRM lead proposal presentation', error),
      )
    }
  },

  async listProposalPresentations(
    leadId: string,
  ): Promise<Result<CrmLeadProposalPresentation[]>> {
    try {
      const presentations = await prisma.crmLeadProposalPresentation.findMany({
        where: { leadId },
        orderBy: { presentedAt: 'desc' },
      })
      return ok(presentations)
    } catch (error) {
      return err(
        dbError('Failed to list CRM lead proposal presentations', error),
      )
    }
  },
}
