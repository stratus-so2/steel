import { ok, type Result } from '@/src/lib/result'
import { toCrmActivityDTO } from '@/src/mappers/crm-activity.mapper'
import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import type { ListCrmActivitiesDTO } from '@/src/schemas/crm-activity.schema'
import type { CrmActivityDTO } from '@/types/crm-activity'
import { assertMember } from './authz'

export const CrmActivityService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmActivitiesDTO,
  ): Promise<Result<CrmActivityDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmActivityRepository.listByWorkspace(
      workspaceId,
      filters,
    )
    if (!result.ok) return result

    return ok(result.value.map(toCrmActivityDTO))
  },
}
