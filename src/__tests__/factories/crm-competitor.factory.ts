import { createId } from '@paralleldrive/cuid2'
import type { CrmTrackedCompetitor } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeCrmCompetitor(
  overrides?: Partial<CrmTrackedCompetitor>,
): CrmTrackedCompetitor {
  const now = new Date()
  return {
    id: createId(),
    platform: 'INSTAGRAM',
    handle: '@concorrente',
    profileUrl: null,
    followersCount: null,
    avatarUrl: null,
    displayName: null,
    bio: null,
    syncStatus: 'MANUAL',
    lastSyncedAt: null,
    notes: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedCrmCompetitor(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmTrackedCompetitor,
      | 'platform'
      | 'handle'
      | 'profileUrl'
      | 'followersCount'
      | 'avatarUrl'
      | 'displayName'
      | 'bio'
      | 'syncStatus'
      | 'lastSyncedAt'
      | 'notes'
      | 'deletedAt'
    >
  >,
) {
  return prisma.crmTrackedCompetitor.create({
    data: {
      platform: 'INSTAGRAM',
      handle: '@concorrente',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}
