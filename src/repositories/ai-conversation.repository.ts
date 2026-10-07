import type {
  AiConversation,
  AiConversationMode,
  AiMessage,
  AiMessageRole,
  Prisma,
} from '@prisma/client'
import { aiConversationNotFound } from '@/src/errors/app-error'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const LIST_LIMIT = 100

/** Steel AI conversations — always scoped by workspace **and** owner. */
export const AiConversationRepository = {
  /** Pinned first, then most recently updated. `q` filters the title. */
  async listByUser(
    workspaceId: string,
    userId: string,
    q?: string,
  ): Promise<Result<AiConversation[]>> {
    try {
      const conversations = await prisma.aiConversation.findMany({
        where: {
          workspaceId,
          userId,
          deletedAt: null,
          ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: [
          { pinnedAt: { sort: 'desc', nulls: 'last' } },
          { updatedAt: 'desc' },
        ],
        take: LIST_LIMIT,
      })
      return ok(conversations)
    } catch (error) {
      return err(dbError('Failed to list AI conversations', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<Result<AiConversation>> {
    try {
      const conversation = await prisma.aiConversation.findFirst({
        where: { id, workspaceId, userId, deletedAt: null },
      })
      if (!conversation) return err(aiConversationNotFound())
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find AI conversation', error))
    }
  },

  async create(data: {
    workspaceId: string
    userId: string
    title?: string | null
    mode?: AiConversationMode
    modelKey?: string | null
  }): Promise<Result<AiConversation>> {
    try {
      const conversation = await prisma.aiConversation.create({ data })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to create AI conversation', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string | null
      mode?: AiConversationMode
      pinnedAt?: Date | null
      modelKey?: string | null
    },
  ): Promise<Result<AiConversation>> {
    try {
      const conversation = await prisma.aiConversation.update({
        where: { id },
        data,
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to update AI conversation', error))
    }
  },

  /**
   * Sets the title only while it is still empty, so an auto-title never
   * overwrites one the user typed in the meantime. Returns whether it won.
   */
  async setTitleIfEmpty(id: string, title: string): Promise<Result<boolean>> {
    try {
      const { count } = await prisma.aiConversation.updateMany({
        where: { id, title: null },
        data: { title },
      })
      return ok(count > 0)
    } catch (error) {
      return err(dbError('Failed to set AI conversation title', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.aiConversation.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete AI conversation', error))
    }
  },
}

export interface CreateAiMessageInput {
  id?: string
  conversationId: string
  role: AiMessageRole
  content: string
  toolCalls?: Prisma.InputJsonValue
  toolCallId?: string | null
  toolName?: string | null
  raw?: Prisma.InputJsonValue
  modelKey?: string | null
  inputTokens?: number
  outputTokens?: number
}

/** Last `createdAt` handed out, so consecutive inserts never tie. */
let lastStamp = 0

function nextStamps(count: number): number {
  const base = Math.max(Date.now(), lastStamp + 1)
  lastStamp = base + count - 1
  return base
}

/** Transcript rows (USER / ASSISTANT / TOOL) of a conversation. */
export const AiMessageRepository = {
  /** Whole transcript, oldest first. */
  async listByConversation(
    conversationId: string,
  ): Promise<Result<AiMessage[]>> {
    try {
      const messages = await prisma.aiMessage.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      return ok(messages)
    } catch (error) {
      return err(dbError('Failed to list AI messages', error))
    }
  },

  /** The `limit` most recent rows, returned oldest first. */
  async listRecent(
    conversationId: string,
    limit: number,
  ): Promise<Result<AiMessage[]>> {
    try {
      const messages = await prisma.aiMessage.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
      return ok(messages.reverse())
    } catch (error) {
      return err(dbError('Failed to list recent AI messages', error))
    }
  },

  async countByRole(
    conversationId: string,
    role: AiMessageRole,
  ): Promise<Result<number>> {
    try {
      const count = await prisma.aiMessage.count({
        where: { conversationId, role },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count AI messages', error))
    }
  },

  /**
   * Inserts the rows of one round in order. `createdAt` is strictly
   * increasing (1 ms apart) so the transcript order survives rows written
   * within the same millisecond.
   */
  async createMany(rows: CreateAiMessageInput[]): Promise<Result<AiMessage[]>> {
    try {
      const base = nextStamps(rows.length)
      const created = await prisma.$transaction(
        rows.map((row, index) =>
          prisma.aiMessage.create({
            data: { ...row, createdAt: new Date(base + index) },
          }),
        ),
      )
      return ok(created)
    } catch (error) {
      return err(dbError('Failed to create AI messages', error))
    }
  },
}
