import type { AiMemory, AiMemorySource, AiScope } from '@prisma/client'
import { aiMemoryNotFound } from '@/src/errors/app-error'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export interface AiMemoryCreateInput {
  workspaceId: string
  scope: AiScope
  userId: string | null
  content: string
  source: AiMemorySource
  sourceConversationId: string | null
  createdById: string
}

/** Cap of a single listing (the tab and the prompt both read the newest). */
export const AI_MEMORY_LIST_MAX = 500

const visibleTo = (workspaceId: string, userId: string) => ({
  workspaceId,
  deletedAt: null,
  OR: [{ scope: 'WORKSPACE' as const }, { scope: 'PERSONAL' as const, userId }],
})

/** Steel AI memories (soft-deleted rows are never returned). */
export const AiMemoryRepository = {
  /**
   * Workspace memories and the user's personal ones, newest first,
   * optionally filtered by a case-insensitive text search.
   */
  async listVisible(
    workspaceId: string,
    userId: string,
    options: { q?: string; take?: number } = {},
  ): Promise<Result<AiMemory[]>> {
    try {
      const rows = await prisma.aiMemory.findMany({
        where: {
          ...visibleTo(workspaceId, userId),
          ...(options.q && {
            content: { contains: options.q, mode: 'insensitive' as const },
          }),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: options.take ?? AI_MEMORY_LIST_MAX,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list AI memories', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<AiMemory>> {
    try {
      const row = await prisma.aiMemory.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      return row ? ok(row) : err(aiMemoryNotFound())
    } catch (error) {
      return err(dbError('Failed to find AI memory', error))
    }
  },

  async create(data: AiMemoryCreateInput): Promise<Result<AiMemory>> {
    try {
      const row = await prisma.aiMemory.create({ data })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create AI memory', error))
    }
  },

  async updateContent(id: string, content: string): Promise<Result<AiMemory>> {
    try {
      const row = await prisma.aiMemory.update({
        where: { id },
        data: { content },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update AI memory', error))
    }
  },

  async softDelete(id: string): Promise<Result<AiMemory>> {
    try {
      const row = await prisma.aiMemory.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to delete AI memory', error))
    }
  },

  /** Marks memories as read into a prompt (does not touch `updatedAt`). */
  async touchUsed(ids: string[], at: Date): Promise<Result<number>> {
    if (ids.length === 0) return ok(0)
    try {
      // Raw update: Prisma's @updatedAt would otherwise bump `updated_at`
      // and reshuffle the "newest first" order on every turn.
      const count = await prisma.$executeRaw`
        UPDATE ai_memories SET last_used_at = ${at}
        WHERE id = ANY(${ids}::text[])`
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to mark AI memories as used', error))
    }
  },
}
