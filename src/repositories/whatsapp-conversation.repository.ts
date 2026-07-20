import type { Prisma, WhatsAppConversation } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const conversationListInclude = {
  contact: true,
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.WhatsAppConversationInclude

export type WhatsAppConversationWithPreview =
  Prisma.WhatsAppConversationGetPayload<{
    include: typeof conversationListInclude
  }>

export const WhatsAppConversationRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters: {
      status?: 'NEW' | 'IN_PROGRESS' | 'CLOSED'
      assignedUserId?: string
    } = {},
  ): Promise<Result<WhatsAppConversationWithPreview[]>> {
    try {
      const conversations = await prisma.whatsAppConversation.findMany({
        where: {
          workspaceId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.assignedUserId
            ? { assignedUserId: filters.assignedUserId }
            : {}),
        },
        include: conversationListInclude,
        orderBy: { lastMessageAt: 'desc' },
      })
      return ok(conversations)
    } catch (error) {
      return err(dbError('Failed to list whatsapp conversations', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppConversationWithPreview | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findFirst({
        where: { id, workspaceId },
        include: conversationListInclude,
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find whatsapp conversation', error))
    }
  },

  async findByIdRaw(id: string): Promise<Result<WhatsAppConversation | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id },
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find whatsapp conversation', error))
    }
  },

  async findActiveByContact(
    workspaceId: string,
    contactId: string,
  ): Promise<Result<WhatsAppConversation | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findFirst({
        where: {
          workspaceId,
          contactId,
          status: { in: ['NEW', 'IN_PROGRESS'] },
        },
        orderBy: { createdAt: 'desc' },
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find active whatsapp conversation', error))
    }
  },

  async create(
    data: Prisma.WhatsAppConversationUncheckedCreateInput,
  ): Promise<Result<WhatsAppConversation>> {
    try {
      const conversation = await prisma.whatsAppConversation.create({ data })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to create whatsapp conversation', error))
    }
  },

  async update(
    id: string,
    data: Prisma.WhatsAppConversationUncheckedUpdateInput,
  ): Promise<Result<WhatsAppConversation>> {
    try {
      const conversation = await prisma.whatsAppConversation.update({
        where: { id },
        data,
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to update whatsapp conversation', error))
    }
  },
}
