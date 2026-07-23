import type { CrmQuota, CrmQuotaPeriod } from '@prisma/client'
import { crmQuotaConflict, notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmQuotaRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: { ownerId?: string; period?: CrmQuotaPeriod },
  ): Promise<Result<CrmQuota[]>> {
    try {
      const quotas = await prisma.crmQuota.findMany({
        where: {
          workspaceId,
          ...(filters?.ownerId ? { ownerId: filters.ownerId } : {}),
          ...(filters?.period ? { period: filters.period } : {}),
        },
        orderBy: { periodKey: 'desc' },
      })
      return ok(quotas)
    } catch (error) {
      return err(dbError('Failed to list CRM quotas', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmQuota>> {
    try {
      const quota = await prisma.crmQuota.findFirst({
        where: { id, workspaceId },
      })
      if (!quota) return err(notFound('CrmQuota'))
      return ok(quota)
    } catch (error) {
      return err(dbError('Failed to find CRM quota by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    ownerId: string
    period: CrmQuotaPeriod
    periodKey: string
    targetAmount?: number
  }): Promise<Result<CrmQuota>> {
    try {
      const quota = await prisma.crmQuota.create({ data })
      return ok(quota)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(crmQuotaConflict())
      }
      return err(dbError('Failed to create CRM quota', error))
    }
  },

  async update(
    id: string,
    data: { targetAmount?: number; updatedById?: string },
  ): Promise<Result<CrmQuota>> {
    try {
      const quota = await prisma.crmQuota.update({ where: { id }, data })
      return ok(quota)
    } catch (error) {
      return err(dbError('Failed to update CRM quota', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmQuota.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM quota', error))
    }
  },
}
