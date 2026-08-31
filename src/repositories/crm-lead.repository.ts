import type { CrmLead, CrmLeadStage } from '@prisma/client'
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
}
