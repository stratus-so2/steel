import type {
  CrmScheduledPost,
  CrmScheduledPostTarget,
  CrmSocialConnection,
} from '@prisma/client'
import type {
  CrmScheduledPostDTO,
  CrmScheduledPostTargetDTO,
  CrmSocialConnectionDTO,
} from '@/types/crm-social'

export function toCrmSocialConnectionDTO(
  connection: CrmSocialConnection,
): CrmSocialConnectionDTO {
  return {
    id: connection.id,
    platform: connection.platform,
    externalAccountId: connection.externalAccountId,
    accountName: connection.accountName,
    status: connection.status,
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
    error: target.error,
    publishedAt: target.publishedAt ? target.publishedAt.toISOString() : null,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  }
}

export function toCrmScheduledPostDTO(
  post: CrmScheduledPost & { targets?: CrmScheduledPostTarget[] },
): CrmScheduledPostDTO {
  return {
    id: post.id,
    content: post.content,
    title: post.title,
    status: post.status,
    scheduledFor: post.scheduledFor ? post.scheduledFor.toISOString() : null,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    workspaceId: post.workspaceId,
    createdById: post.createdById,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    targets: post.targets?.map(toCrmScheduledPostTargetDTO),
  }
}
