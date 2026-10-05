import type {
  CrmCompetitorIdeaSet,
  CrmCompetitorMetricSnapshot,
  CrmTrackedCompetitor,
} from '@prisma/client'
import z from 'zod'
import {
  CRM_COMPETITOR_METRICS_RANGES,
  CrmCompetitorIdeaSchema,
} from '@/src/schemas/crm-competitor.schema'
import type {
  CrmCompetitorDTO,
  CrmCompetitorIdeaSetDTO,
  CrmCompetitorMetricSnapshotDTO,
} from '@/types/crm-competitor'

const StoredIdeasSchema = z.array(CrmCompetitorIdeaSchema)

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

/**
 * `ideas` is JSON written by the service after validation; a row that no
 * longer matches the contract maps to an empty list instead of breaking the
 * screen.
 */
export function toCrmCompetitorIdeaSetDTO(
  set: CrmCompetitorIdeaSet,
): CrmCompetitorIdeaSetDTO {
  const ideas = StoredIdeasSchema.safeParse(set.ideas)
  const range = z.enum(CRM_COMPETITOR_METRICS_RANGES).safeParse(set.range)
  return {
    id: set.id,
    competitorId: set.competitorId,
    range: range.success ? range.data : '30d',
    ideas: ideas.success ? ideas.data : [],
    modelKey: set.modelKey,
    createdById: set.createdById,
    createdAt: set.createdAt.toISOString(),
  }
}
