import type { Prisma, WhatsAppMessage } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WhatsAppMessageRepository = {
  async listByConversation(
    conversationId: string,
    options: { cursor?: string; limit: number; after?: Date | null },
  ): Promise<Result<WhatsAppMessage[]>> {
    try {
      const messages = await prisma.whatsAppMessage.findMany({
        where: {
          conversationId,
          ...(options.after ? { createdAt: { gt: options.after } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      })
      return ok(messages.reverse())
    } catch (error) {
      return err(dbError('Failed to list whatsapp messages', error))
    }
  },

  async findByProviderMessageId(
    providerMessageId: string,
  ): Promise<Result<WhatsAppMessage | null>> {
    try {
      const message = await prisma.whatsAppMessage.findUnique({
        where: { providerMessageId },
      })
      return ok(message)
    } catch (error) {
      return err(
        dbError('Failed to find whatsapp message by provider id', error),
      )
    }
  },

  async findById(id: string): Promise<Result<WhatsAppMessage | null>> {
    try {
      const message = await prisma.whatsAppMessage.findUnique({
        where: { id },
      })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to find whatsapp message', error))
    }
  },

  async create(
    data: Prisma.WhatsAppMessageUncheckedCreateInput,
  ): Promise<Result<WhatsAppMessage>> {
    try {
      const message = await prisma.whatsAppMessage.create({ data })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to create whatsapp message', error))
    }
  },

  async updateStatusByProviderMessageId(
    providerMessageId: string,
    status: WhatsAppMessage['status'],
  ): Promise<Result<WhatsAppMessage | null>> {
    try {
      const existing = await prisma.whatsAppMessage.findUnique({
        where: { providerMessageId },
      })
      if (!existing) return ok(null)

      const message = await prisma.whatsAppMessage.update({
        where: { providerMessageId },
        data: { status },
      })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to update whatsapp message status', error))
    }
  },

  async updateReactionByProviderMessageId(
    providerMessageId: string,
    reaction: { emoji: string | null; reactedByContact: boolean },
  ): Promise<Result<WhatsAppMessage | null>> {
    try {
      const existing = await prisma.whatsAppMessage.findUnique({
        where: { providerMessageId },
      })
      if (!existing) return ok(null)

      const message = await prisma.whatsAppMessage.update({
        where: { providerMessageId },
        data: {
          reactionEmoji: reaction.emoji || null,
          reactedByContact: reaction.emoji ? reaction.reactedByContact : null,
        },
      })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to update whatsapp message reaction', error))
    }
  },

  async update(
    id: string,
    data: Prisma.WhatsAppMessageUpdateInput,
  ): Promise<Result<WhatsAppMessage>> {
    try {
      const message = await prisma.whatsAppMessage.update({
        where: { id },
        data,
      })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to update whatsapp message', error))
    }
  },
}
