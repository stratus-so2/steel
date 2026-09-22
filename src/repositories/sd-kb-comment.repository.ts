import type { Prisma, SdKbComment, User } from '@prisma/client'
import { sdKbCommentNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export type SdKbCommentWithAuthor = SdKbComment & {
  author: Pick<User, 'id' | 'name' | 'image'> | null
}

const authorSelect = {
  select: { id: true, name: true, image: true },
} as const

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'P2025'
}

export const SdKbCommentRepository = {
  async findById(id: string): Promise<Result<SdKbComment>> {
    try {
      const comment = await prisma.sdKbComment.findUnique({ where: { id } })
      if (!comment) return err(sdKbCommentNotFound())
      return ok(comment)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk KB comment', error))
    }
  },

  async listByArticle(
    articleId: string,
  ): Promise<Result<SdKbCommentWithAuthor[]>> {
    try {
      const comments = await prisma.sdKbComment.findMany({
        where: { articleId },
        include: { author: authorSelect },
        orderBy: [{ markId: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(comments)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk KB comments', error))
    }
  },

  async create(data: {
    articleId: string
    authorId: string
    markId: string
    content: Prisma.InputJsonValue
    parentId?: string
  }): Promise<Result<SdKbCommentWithAuthor>> {
    try {
      const comment = await prisma.sdKbComment.create({
        data,
        include: { author: authorSelect },
      })
      return ok(comment)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk KB comment', error))
    }
  },

  async update(
    id: string,
    content: Prisma.InputJsonValue,
  ): Promise<Result<SdKbCommentWithAuthor>> {
    try {
      const comment = await prisma.sdKbComment.update({
        where: { id },
        data: { content },
        include: { author: authorSelect },
      })
      return ok(comment)
    } catch (error) {
      if (isNotFound(error)) return err(sdKbCommentNotFound())
      return err(dbError('Failed to update ServiceDesk KB comment', error))
    }
  },

  async resolve(
    id: string,
    data: { resolved: boolean; resolvedById: string | null },
  ): Promise<Result<SdKbCommentWithAuthor>> {
    try {
      const comment = await prisma.sdKbComment.update({
        where: { id },
        data: {
          resolved: data.resolved,
          resolvedById: data.resolved ? data.resolvedById : null,
          resolvedAt: data.resolved ? new Date() : null,
        },
        include: { author: authorSelect },
      })
      return ok(comment)
    } catch (error) {
      if (isNotFound(error)) return err(sdKbCommentNotFound())
      return err(dbError('Failed to resolve ServiceDesk KB comment', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdKbComment.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      if (isNotFound(error)) return err(sdKbCommentNotFound())
      return err(dbError('Failed to delete ServiceDesk KB comment', error))
    }
  },
}
