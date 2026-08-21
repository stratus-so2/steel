import type {
  CrmScheduledPost,
  CrmScheduledPostMedia,
  CrmScheduledPostTarget,
  CrmSocialConnection,
} from '@prisma/client'
import type {
  CrmScheduledPostDTO,
  CrmScheduledPostMediaDTO,
  CrmScheduledPostTargetDTO,
  CrmSocialConnectionDTO,
} from '@/types/crm-social'

/** Nunca inclui accessToken/refreshToken — tokens não fazem parte do DTO. */
export function toCrmSocialConnectionDTO(
  connection: CrmSocialConnection,
): CrmSocialConnectionDTO {
  return {
    id: connection.id,
    platform: connection.platform,
    externalAccountId: connection.externalAccountId,
    accountName: connection.accountName,
    scope: connection.scope,
    isPrimary: connection.isPrimary,
    status: connection.status,
    expiresAt: connection.tokenExpiresAt
      ? connection.tokenExpiresAt.toISOString()
      : null,
    workspaceId: connection.workspaceId,
    createdById: connection.createdById,
    updatedById: connection.updatedById,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  }
}

export function toCrmScheduledPostTargetDTO(
  target: CrmScheduledPostTarget,
): CrmScheduledPostTargetDTO {
  return {
    id: target.id,
    postId: target.postId,
    platform: target.platform,
    status: target.status,
    externalPostId: target.externalPostId,
    error: target.error,
    attempts: target.attempts,
    publishedAt: target.publishedAt ? target.publishedAt.toISOString() : null,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  }
}

export function toCrmScheduledPostMediaDTO(
  media: CrmScheduledPostMedia,
): CrmScheduledPostMediaDTO {
  return {
    id: media.id,
    kind: media.kind,
    contentType: media.contentType,
    sizeBytes: media.sizeBytes,
    order: media.order,
  }
}

export function toCrmScheduledPostDTO(
  post: CrmScheduledPost & {
    targets?: CrmScheduledPostTarget[]
    media?: CrmScheduledPostMedia[]
  },
): CrmScheduledPostDTO {
  return {
    id: post.id,
    content: post.content,
    title: post.title,
    status: post.status,
    scheduledFor: post.scheduledFor ? post.scheduledFor.toISOString() : null,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    lastError: post.lastError,
    workspaceId: post.workspaceId,
    createdById: post.createdById,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    targets: post.targets?.map(toCrmScheduledPostTargetDTO),
    media: post.media?.map(toCrmScheduledPostMediaDTO),
  }
}
