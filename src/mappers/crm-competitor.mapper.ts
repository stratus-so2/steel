import type {
  CrmCompetitorMetricSnapshot,
  CrmTrackedCompetitor,
} from '@prisma/client'
import type {
  CrmCompetitorDTO,
  CrmCompetitorMetricSnapshotDTO,
} from '@/types/crm-competitor'

export function toCrmCompetitorDTO(
  competitor: CrmTrackedCompetitor,
): CrmCompetitorDTO {
  return {
    id: competitor.id,
    platform: competitor.platform,
    handle: competitor.handle,
    profileUrl: competitor.profileUrl,
    followersCount: competitor.followersCount,
    avatarUrl: competitor.avatarUrl,
    displayName: competitor.displayName,
    bio: competitor.bio,
    syncStatus: competitor.syncStatus,
    lastSyncedAt: competitor.lastSyncedAt?.toISOString() ?? null,
    notes: competitor.notes,
    workspaceId: competitor.workspaceId,
    createdById: competitor.createdById,
    updatedById: competitor.updatedById,
    position: competitor.position,
    createdAt: competitor.createdAt.toISOString(),
    updatedAt: competitor.updatedAt.toISOString(),
  }
}

export function toCrmCompetitorMetricSnapshotDTO(
  snapshot: CrmCompetitorMetricSnapshot,
): CrmCompetitorMetricSnapshotDTO {
  return {
    id: snapshot.id,
    followersCount: snapshot.followersCount,
    postsCount: snapshot.postsCount,
    capturedAt: snapshot.capturedAt.toISOString(),
  }
}
