import type { CrmActivity } from '@prisma/client'
import type { CrmActivityDTO } from '@/types/crm-activity'

export function toCrmActivityDTO(activity: CrmActivity): CrmActivityDTO {
  return {
    id: activity.id,
    workspaceId: activity.workspaceId,
    actorUserId: activity.actorUserId,
    action: activity.action,
    entity: activity.entity,
    entityId: activity.entityId,
    companyId: activity.companyId,
    personId: activity.personId,
    opportunityId: activity.opportunityId,
    summary: activity.summary,
    createdAt: activity.createdAt.toISOString(),
  }
}
