import type {
  CrmCampaignRecipientScope,
  CrmCampaignRecipientStatus,
  CrmCampaignStatus,
  CrmEmailCampaign,
  CrmEmailCampaignRecipient,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmEmailCampaignRepository = {
  async listByWorkspace(workspaceId: string): Promise<
    Result<
      (CrmEmailCampaign & {
        _count: { recipients: number }
        recipients: { status: CrmCampaignRecipientStatus }[]
      })[]
    >
  > {
    try {
      const campaigns = await prisma.crmEmailCampaign.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { recipients: true } },
          recipients: { select: { status: true } },
        },
      })
      return ok(campaigns)
    } catch (error) {
      return err(dbError('Failed to list CRM email campaigns', error))
    }
  },

  /** Campanhas agendadas cuja hora de disparo já chegou — cross-workspace,
   * usada pelo tick do worker, não pela API. */
  async listDueScheduled(now: Date): Promise<Result<CrmEmailCampaign[]>> {
    try {
      const campaigns = await prisma.crmEmailCampaign.findMany({
        where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      })
      return ok(campaigns)
    } catch (error) {
      return err(dbError('Failed to list due CRM email campaigns', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmEmailCampaign>> {
    try {
      const campaign = await prisma.crmEmailCampaign.findFirst({
        where: { id, workspaceId },
      })
      if (!campaign) return err(notFound('CrmEmailCampaign'))
      return ok(campaign)
    } catch (error) {
      return err(dbError('Failed to find CRM email campaign by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    subject: string
    contentHtml: string
    contentJson?: string
    fromAddress: string
    recipientScope: CrmCampaignRecipientScope
    scheduledAt?: Date
  }): Promise<Result<CrmEmailCampaign>> {
    try {
      const campaign = await prisma.crmEmailCampaign.create({
        data: {
          ...data,
          status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        },
      })
      return ok(campaign)
    } catch (error) {
      return err(dbError('Failed to create CRM email campaign', error))
    }
  },

  async update(
    id: string,
    data: {
      subject?: string
      contentHtml?: string
      contentJson?: string
      fromAddress?: string
      scheduledAt?: Date
    },
  ): Promise<Result<CrmEmailCampaign>> {
    try {
      const campaign = await prisma.crmEmailCampaign.update({
        where: { id },
        data,
      })
      return ok(campaign)
    } catch (error) {
      return err(dbError('Failed to update CRM email campaign', error))
    }
  },

  async setStatus(
    id: string,
    status: CrmCampaignStatus,
    sentAt?: Date,
  ): Promise<Result<CrmEmailCampaign>> {
    try {
      const campaign = await prisma.crmEmailCampaign.update({
        where: { id },
        data: { status, sentAt },
      })
      return ok(campaign)
    } catch (error) {
      return err(dbError('Failed to update CRM email campaign status', error))
    }
  },
}

export const CrmEmailCampaignRecipientRepository = {
  async listByCampaign(
    campaignId: string,
  ): Promise<Result<CrmEmailCampaignRecipient[]>> {
    try {
      const recipients = await prisma.crmEmailCampaignRecipient.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'asc' },
      })
      return ok(recipients)
    } catch (error) {
      return err(dbError('Failed to list CRM email campaign recipients', error))
    }
  },

  async createMany(
    campaignId: string,
    recipients: { email: string; name?: string; personId?: string }[],
  ): Promise<Result<number>> {
    try {
      const result = await prisma.crmEmailCampaignRecipient.createMany({
        data: recipients.map((recipient) => ({ campaignId, ...recipient })),
      })
      return ok(result.count)
    } catch (error) {
      return err(
        dbError('Failed to create CRM email campaign recipients', error),
      )
    }
  },

  async markSent(
    id: string,
    providerMessageId?: string,
  ): Promise<Result<void>> {
    try {
      await prisma.crmEmailCampaignRecipient.update({
        where: { id },
        data: { status: 'SENT', providerMessageId, sentAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to mark CRM campaign recipient sent', error))
    }
  },

  async markFailed(id: string, errorMessage: string): Promise<Result<void>> {
    try {
      await prisma.crmEmailCampaignRecipient.update({
        where: { id },
        data: { status: 'FAILED' as CrmCampaignRecipientStatus, errorMessage },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to mark CRM campaign recipient failed', error))
    }
  },
}
