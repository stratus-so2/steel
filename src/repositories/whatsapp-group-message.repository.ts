import type { Prisma, WhatsAppGroupMessage } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WhatsAppGroupMessageRepository = {
  async listByGroup(
    groupId: string,
    options: { cursor?: string; limit: number },
  ): Promise<Result<WhatsAppGroupMessage[]>> {
    try {
      const messages = await prisma.whatsAppGroupMessage.findMany({
        where: { groupId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      })
      return ok(messages.reverse())
    } catch (error) {
      return err(dbError('Failed to list whatsapp group messages', error))
    }
  },

  async findById(id: string): Promise<Result<WhatsAppGroupMessage | null>> {
    try {
      const message = await prisma.whatsAppGroupMessage.findUnique({
        where: { id },
      })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to find whatsapp group message', error))
    }
  },

  async findByProviderMessageId(
    providerMessageId: string,
  ): Promise<Result<WhatsAppGroupMessage | null>> {
    try {
      const message = await prisma.whatsAppGroupMessage.findUnique({
        where: { providerMessageId },
      })
      return ok(message)
    } catch (error) {
      return err(
        dbError('Failed to find whatsapp group message by provider id', error),
      )
    }
  },

  async create(
    data: Prisma.WhatsAppGroupMessageUncheckedCreateInput,
  ): Promise<Result<WhatsAppGroupMessage>> {
    try {
      const message = await prisma.whatsAppGroupMessage.create({ data })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to create whatsapp group message', error))
    }
  },

  async update(
    id: string,
    data: Prisma.WhatsAppGroupMessageUpdateInput,
  ): Promise<Result<WhatsAppGroupMessage>> {
    try {
      const message = await prisma.whatsAppGroupMessage.update({
        where: { id },
        data,
      })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to update whatsapp group message', error))
    }
  },

  async updateStatusByProviderMessageId(
    providerMessageId: string,
    status: WhatsAppGroupMessage['status'],
  ): Promise<Result<WhatsAppGroupMessage | null>> {
    try {
      const existing = await prisma.whatsAppGroupMessage.findUnique({
        where: { providerMessageId },
      })
      if (!existing) return ok(null)

      const message = await prisma.whatsAppGroupMessage.update({
        where: { providerMessageId },
        data: { status },
      })
      return ok(message)
    } catch (error) {
      return err(
        dbError('Failed to update whatsapp group message status', error),
      )
    }
  },
}
