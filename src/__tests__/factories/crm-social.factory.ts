import { createId } from '@paralleldrive/cuid2'
import type {
  CrmScheduledPost,
  CrmScheduledPostTarget,
  CrmSocialConnection,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeCrmSocialConnection(
  overrides?: Partial<CrmSocialConnection>,
): CrmSocialConnection {
  const now = new Date()
  return {
    id: createId(),
    platform: 'INSTAGRAM',
    externalAccountId: 'acc-1',
    accountName: '@acme',
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    scope: null,
    isPrimary: false,
    status: 'CONNECTED',
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmSocialConnection(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmSocialConnection, 'platform' | 'status' | 'externalAccountId'>
  >,
) {
  return prisma.crmSocialConnection.create({
    data: {
      platform: 'INSTAGRAM',
      externalAccountId: 'acc-1',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export function createFakeCrmScheduledPost(
  overrides?: Partial<CrmScheduledPost>,
): CrmScheduledPost {
  const now = new Date()
  return {
    id: createId(),
    content: 'Olá mundo',
    title: null,
    options: null,
    status: 'DRAFT',
    scheduledFor: null,
    publishedAt: null,
    lastError: null,
    workspaceId: createId(),
    createdById: createId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedCrmScheduledPost(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmScheduledPost, 'content' | 'status' | 'deletedAt'>
  >,
) {
  return prisma.crmScheduledPost.create({
    data: { workspaceId, createdById, ...overrides },
  })
}

export function createFakeCrmScheduledPostTarget(
  overrides?: Partial<CrmScheduledPostTarget>,
): CrmScheduledPostTarget {
  const now = new Date()
  return {
    id: createId(),
    postId: createId(),
    platform: 'INSTAGRAM',
    status: 'PENDING',
    externalPostId: null,
    error: null,
    attempts: 0,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmScheduledPostTarget(
  postId: string,
  overrides?: Partial<Pick<CrmScheduledPostTarget, 'platform' | 'status'>>,
) {
  return prisma.crmScheduledPostTarget.create({
    data: { postId, platform: 'INSTAGRAM', ...overrides },
  })
}
