import type { CrmActivity } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmActivityRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: { companyId?: string; personId?: string; opportunityId?: string },
  ): Promise<Result<CrmActivity[]>> {
    try {
      const activities = await prisma.crmActivity.findMany({
        where: {
          workspaceId,
          ...(filters?.companyId ? { companyId: filters.companyId } : {}),
          ...(filters?.personId ? { personId: filters.personId } : {}),
          ...(filters?.opportunityId
            ? { opportunityId: filters.opportunityId }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      })
      return ok(activities)
    } catch (error) {
      return err(dbError('Failed to list CRM activities', error))
    }
  },

  async record(data: {
    workspaceId: string
    actorUserId?: string
    action: string
    entity: string
    entityId: string
    companyId?: string
    personId?: string
    opportunityId?: string
    summary?: string
  }): Promise<Result<CrmActivity>> {
    try {
      const activity = await prisma.crmActivity.create({ data })
      return ok(activity)
    } catch (error) {
      return err(dbError('Failed to record CRM activity', error))
    }
  },
}
