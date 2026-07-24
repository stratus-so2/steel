import type { CrmSocialPlatform, CrmTrackedCompetitor } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export type CreateCrmCompetitorData = {
  workspaceId: string
  createdById: string
  platform: CrmSocialPlatform
  handle: string
  profileUrl?: string | null
  followersCount?: number | null
  notes?: string | null
}

export type UpdateCrmCompetitorData = {
  updatedById: string
  platform?: CrmSocialPlatform
  handle?: string
  profileUrl?: string | null
  followersCount?: number | null
  notes?: string | null
}

export const CrmCompetitorRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmTrackedCompetitor[]>> {
    try {
      const items = await prisma.crmTrackedCompetitor.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      })
      return ok(items)
    } catch (error) {
      return err(dbError('Failed to list CRM tracked competitors', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmTrackedCompetitor>> {
    try {
      const item = await prisma.crmTrackedCompetitor.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!item) return err(notFound('CrmTrackedCompetitor'))
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to find CRM tracked competitor by id', error))
    }
  },

  async create(
    data: CreateCrmCompetitorData,
  ): Promise<Result<CrmTrackedCompetitor>> {
    try {
      const item = await prisma.crmTrackedCompetitor.create({ data })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to create CRM tracked competitor', error))
    }
  },

  async update(
    id: string,
    data: UpdateCrmCompetitorData,
  ): Promise<Result<CrmTrackedCompetitor>> {
    try {
      const item = await prisma.crmTrackedCompetitor.update({
        where: { id },
        data,
      })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to update CRM tracked competitor', error))
    }
  },

  async softDelete(id: string, updatedById: string): Promise<Result<void>> {
    try {
      await prisma.crmTrackedCompetitor.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM tracked competitor', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.crmTrackedCompetitor.updateMany({
            where: { id, workspaceId, deletedAt: null },
            data: { position: index + 1 },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM tracked competitors', error))
    }
  },
}
