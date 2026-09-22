import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import {
  sdKbCommentForbidden,
  sdKbCommentNestingTooDeep,
  sdKbCommentNotFound,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdKbCommentDTO } from '@/src/mappers/sd-kb-comment.mapper'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbCommentRepository } from '@/src/repositories/sd-kb-comment.repository'
import type {
  CreateSdKbCommentDTO,
  ResolveSdKbCommentDTO,
  UpdateSdKbCommentDTO,
} from '@/src/schemas/sd-kb-comment.schema'
import type { SdKbCommentDTO } from '@/types/sd-kb-comment'
import type { SdAccessContext } from './sd-access'
import { resolveSdKbEditor } from './sd-kb-access'

/**
 * Discussões do editor (port dos comentários da Wiki do Nexo). São internas:
 * só agentes leem e comentam. Resposta entra na discussão da raiz (um nível),
 * só a raiz é resolvida, só o autor edita e o autor ou um admin exclui.
 */

const ENTITY = 'sd_kb_comment'

async function gate(
  actorId: string,
  workspaceId: string,
  articleId: string,
  action: 'VIEW' | 'EDIT',
): Promise<Result<SdAccessContext>> {
  const ctx = await resolveSdKbEditor(actorId, workspaceId, action)
  if (!ctx.ok) return ctx
  const article = await SdKbArticleRepository.findById(articleId, workspaceId)
  if (!article.ok) return article
  return ctx
}

async function loadInArticle(commentId: string, articleId: string) {
  const comment = await SdKbCommentRepository.findById(commentId)
  if (!comment.ok) return comment
  if (comment.value.articleId !== articleId) return err(sdKbCommentNotFound())
  return comment
}

export const SdKbCommentService = {
  async list(
    actorId: string,
    workspaceId: string,
    articleId: string,
  ): Promise<Result<SdKbCommentDTO[]>> {
    const ctx = await gate(actorId, workspaceId, articleId, 'VIEW')
    if (!ctx.ok) return ctx

    const result = await SdKbCommentRepository.listByArticle(articleId)
    if (!result.ok) return result
    return ok(result.value.map(toSdKbCommentDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    articleId: string,
    dto: CreateSdKbCommentDTO,
  ): Promise<Result<SdKbCommentDTO>> {
    const ctx = await gate(actorId, workspaceId, articleId, 'EDIT')
    if (!ctx.ok) return ctx

    let markId = dto.markId
    if (dto.parentId) {
      const parent = await loadInArticle(dto.parentId, articleId)
      if (!parent.ok) return parent
      if (parent.value.parentId) return err(sdKbCommentNestingTooDeep())
      // A resposta sempre entra na discussão do pai — o markId do cliente é
      // ignorado, para nunca apontar para outra marca.
      markId = parent.value.markId
    }

    const result = await SdKbCommentRepository.create({
      articleId,
      authorId: actorId,
      markId,
      content: dto.content as Prisma.InputJsonValue,
      parentId: dto.parentId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: ENTITY,
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { articleId },
    })
    return ok(toSdKbCommentDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    articleId: string,
    commentId: string,
    dto: UpdateSdKbCommentDTO,
  ): Promise<Result<SdKbCommentDTO>> {
    const ctx = await gate(actorId, workspaceId, articleId, 'EDIT')
    if (!ctx.ok) return ctx

    const existing = await loadInArticle(commentId, articleId)
    if (!existing.ok) return existing
    if (existing.value.authorId !== actorId) return err(sdKbCommentForbidden())

    const result = await SdKbCommentRepository.update(
      commentId,
      dto.content as Prisma.InputJsonValue,
    )
    if (!result.ok) return result

    auditMutation({
      entity: ENTITY,
      action: 'update',
      actorId,
      targetId: commentId,
    })
    return ok(toSdKbCommentDTO(result.value))
  },

  async resolve(
    actorId: string,
    workspaceId: string,
    articleId: string,
    commentId: string,
    dto: ResolveSdKbCommentDTO,
  ): Promise<Result<SdKbCommentDTO>> {
    const ctx = await gate(actorId, workspaceId, articleId, 'EDIT')
    if (!ctx.ok) return ctx

    const existing = await loadInArticle(commentId, articleId)
    if (!existing.ok) return existing
    if (existing.value.parentId) {
      return err(
        sdKbCommentForbidden('Só a raiz de uma discussão pode ser resolvida'),
      )
    }

    const result = await SdKbCommentRepository.resolve(commentId, {
      resolved: dto.resolved,
      resolvedById: dto.resolved ? actorId : null,
    })
    if (!result.ok) return result

    auditMutation({
      entity: ENTITY,
      action: dto.resolved ? 'resolve' : 'unresolve',
      actorId,
      targetId: commentId,
    })
    return ok(toSdKbCommentDTO(result.value))
  },

  async delete(
    actorId: string,
    workspaceId: string,
    articleId: string,
    commentId: string,
  ): Promise<Result<void>> {
    const ctx = await gate(actorId, workspaceId, articleId, 'EDIT')
    if (!ctx.ok) return ctx

    const existing = await loadInArticle(commentId, articleId)
    if (!existing.ok) return existing
    if (existing.value.authorId !== actorId && !ctx.value.isAdmin) {
      return err(sdKbCommentForbidden())
    }

    const result = await SdKbCommentRepository.delete(commentId)
    if (!result.ok) return result

    auditMutation({
      entity: ENTITY,
      action: 'delete',
      actorId,
      targetId: commentId,
      meta: { articleId },
    })
    return ok(undefined)
  },
}
