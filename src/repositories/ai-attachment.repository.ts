import type { AiAttachment, AiAttachmentKind } from '@prisma/client'
import { aiAttachmentNotFound } from '@/src/errors/app-error'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export interface CreateAiAttachmentInput {
  id?: string
  workspaceId: string
  conversationId: string
  uploadedById: string
  kind: AiAttachmentKind
  filename: string
  contentType: string
  sizeBytes: number
  storageKey: string
  extractedText?: string | null
}

/**
 * Files and photos sent to Steel AI. Uploaded loose (`messageId` null) and
 * bound to the USER message when it is sent. Callers scope by conversation
 * (the conversation itself is already scoped by workspace and owner).
 */
export const AiAttachmentRepository = {
  async create(data: CreateAiAttachmentInput): Promise<Result<AiAttachment>> {
    try {
      const row = await prisma.aiAttachment.create({ data })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create AI attachment', error))
    }
  },

  async findById(
    id: string,
    conversationId: string,
  ): Promise<Result<AiAttachment>> {
    try {
      const row = await prisma.aiAttachment.findFirst({
        where: { id, conversationId },
      })
      if (!row) return err(aiAttachmentNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find AI attachment', error))
    }
  },

  /** Unsent attachments of `uploadedById` among `ids` (others are ignored). */
  async listUnsent(
    ids: string[],
    conversationId: string,
    uploadedById: string,
  ): Promise<Result<AiAttachment[]>> {
    try {
      const rows = await prisma.aiAttachment.findMany({
        where: {
          id: { in: ids },
          conversationId,
          uploadedById,
          messageId: null,
        },
        orderBy: { createdAt: 'asc' },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list unsent AI attachments', error))
    }
  },

  async countUnsent(conversationId: string): Promise<Result<number>> {
    try {
      const count = await prisma.aiAttachment.count({
        where: { conversationId, messageId: null },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count unsent AI attachments', error))
    }
  },

  /** Binds unsent attachments to the message; returns how many were bound. */
  async attachToMessage(
    ids: string[],
    messageId: string,
  ): Promise<Result<number>> {
    try {
      const { count } = await prisma.aiAttachment.updateMany({
        where: { id: { in: ids }, messageId: null },
        data: { messageId },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to attach AI attachments', error))
    }
  },

  /** Attachments already sent in the conversation, oldest first. */
  async listSentByConversation(
    conversationId: string,
  ): Promise<Result<AiAttachment[]>> {
    try {
      const rows = await prisma.aiAttachment.findMany({
        where: { conversationId, messageId: { not: null } },
        orderBy: { createdAt: 'asc' },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list AI attachments', error))
    }
  },

  async listByMessageIds(
    messageIds: string[],
  ): Promise<Result<AiAttachment[]>> {
    if (messageIds.length === 0) return ok([])
    try {
      const rows = await prisma.aiAttachment.findMany({
        where: { messageId: { in: messageIds } },
        orderBy: { createdAt: 'asc' },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list AI attachments by message', error))
    }
  },

  /** Removes an unsent attachment; false when it was already sent or gone. */
  async deleteUnsent(id: string): Promise<Result<boolean>> {
    try {
      const { count } = await prisma.aiAttachment.deleteMany({
        where: { id, messageId: null },
      })
      return ok(count > 0)
    } catch (error) {
      return err(dbError('Failed to delete AI attachment', error))
    }
  },
}
