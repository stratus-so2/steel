import type {
  CrmAiAttachment,
  CrmAiAttachmentKind,
  CrmAiConversation,
  CrmAiMessage,
  CrmAiMessageRole,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmAiConversationRepository = {
  async listByUser(
    workspaceId: string,
    userId: string,
  ): Promise<Result<CrmAiConversation[]>> {
    try {
      const conversations = await prisma.crmAiConversation.findMany({
        where: { workspaceId, userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      })
      return ok(conversations)
    } catch (error) {
      return err(dbError('Failed to list CRM AI conversations', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<Result<CrmAiConversation>> {
    try {
      const conversation = await prisma.crmAiConversation.findFirst({
        where: { id, workspaceId, userId, deletedAt: null },
      })
      if (!conversation) return err(notFound('CrmAiConversation'))
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find CRM AI conversation by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    userId: string
    title?: string
  }): Promise<Result<CrmAiConversation>> {
    try {
      const conversation = await prisma.crmAiConversation.create({ data })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to create CRM AI conversation', error))
    }
  },

  async touch(id: string): Promise<Result<void>> {
    try {
      await prisma.crmAiConversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to touch CRM AI conversation', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmAiConversation.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM AI conversation', error))
    }
  },
}

export const CrmAiMessageRepository = {
  async listByConversation(
    conversationId: string,
  ): Promise<Result<CrmAiMessage[]>> {
    try {
      const messages = await prisma.crmAiMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      })
      return ok(messages)
    } catch (error) {
      return err(dbError('Failed to list CRM AI messages', error))
    }
  },

  async create(data: {
    conversationId: string
    role: CrmAiMessageRole
    content: string
  }): Promise<Result<CrmAiMessage>> {
    try {
      const message = await prisma.crmAiMessage.create({ data })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to create CRM AI message', error))
    }
  },
}

export const CrmAiAttachmentRepository = {
  async create(data: {
    conversationId: string
    kind: CrmAiAttachmentKind
    filename: string
    contentType: string
    sizeBytes: number
    storageKey: string
  }): Promise<Result<CrmAiAttachment>> {
    try {
      const attachment = await prisma.crmAiAttachment.create({ data })
      return ok(attachment)
    } catch (error) {
      return err(dbError('Failed to create CRM AI attachment', error))
    }
  },

  async findPendingByIds(
    ids: string[],
    conversationId: string,
  ): Promise<Result<CrmAiAttachment[]>> {
    try {
      const attachments = await prisma.crmAiAttachment.findMany({
        where: { id: { in: ids }, conversationId, messageId: null },
      })
      return ok(attachments)
    } catch (error) {
      return err(dbError('Failed to find pending CRM AI attachments', error))
    }
  },

  async attachToMessage(
    ids: string[],
    messageId: string,
  ): Promise<Result<void>> {
    try {
      await prisma.crmAiAttachment.updateMany({
        where: { id: { in: ids } },
        data: { messageId },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to attach CRM AI attachments', error))
    }
  },

  async listByMessage(messageId: string): Promise<Result<CrmAiAttachment[]>> {
    try {
      const attachments = await prisma.crmAiAttachment.findMany({
        where: { messageId },
      })
      return ok(attachments)
    } catch (error) {
      return err(dbError('Failed to list CRM AI attachments', error))
    }
  },
}

export const CrmAiUsageRepository = {
  async record(data: {
    workspaceId: string
    conversationId: string
    inputTokens: number
    outputTokens: number
    model: string
  }): Promise<Result<void>> {
    try {
      await prisma.crmAiUsage.create({ data })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to record CRM AI usage', error))
    }
  },
}
