import type { Value } from 'platejs'
import type { SdKbCommentWithAuthor } from '@/src/repositories/sd-kb-comment.repository'
import type { SdKbCommentDTO } from '@/types/sd-kb-comment'

export function toSdKbCommentDTO(
  comment: SdKbCommentWithAuthor,
): SdKbCommentDTO {
  return {
    id: comment.id,
    articleId: comment.articleId,
    markId: comment.markId,
    parentId: comment.parentId ?? null,
    content: comment.content as Value,
    author: comment.author,
    resolved: comment.resolved,
    resolvedAt: comment.resolvedAt?.toISOString() ?? null,
    resolvedById: comment.resolvedById ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}
