import type { CrmTrackedCompetitor } from '@prisma/client'
import type { CrmCompetitorDTO } from '@/types/crm-competitor'

export function toCrmCompetitorDTO(
  competitor: CrmTrackedCompetitor,
): CrmCompetitorDTO {
  return {
    id: competitor.id,
    platform: competitor.platform,
    handle: competitor.handle,
    profileUrl: competitor.profileUrl,
    followersCount: competitor.followersCount,
    notes: competitor.notes,
    workspaceId: competitor.workspaceId,
    createdById: competitor.createdById,
    updatedById: competitor.updatedById,
    position: competitor.position,
    createdAt: competitor.createdAt.toISOString(),
    updatedAt: competitor.updatedAt.toISOString(),
  }
}
