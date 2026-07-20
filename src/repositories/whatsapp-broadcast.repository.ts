import type {
  Prisma,
  WhatsAppBroadcastList,
  WhatsAppBroadcastRecipient,
  WhatsAppBroadcastRecipientStatus,
  WhatsAppBroadcastStatus,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const listInclude = {
  recipients: { select: { status: true } },
} satisfies Prisma.WhatsAppBroadcastListInclude

export type WhatsAppBroadcastListWithCounts =
  Prisma.WhatsAppBroadcastListGetPayload<{ include: typeof listInclude }>

const detailInclude = {
  recipients: { include: { contact: true } },
} satisfies Prisma.WhatsAppBroadcastListInclude

export type WhatsAppBroadcastListWithRecipients =
  Prisma.WhatsAppBroadcastListGetPayload<{ include: typeof detailInclude }>

export const WhatsAppBroadcastRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<WhatsAppBroadcastListWithCounts[]>> {
    try {
      const lists = await prisma.whatsAppBroadcastList.findMany({
        where: { workspaceId },
        include: listInclude,
        orderBy: { createdAt: 'desc' },
      })
      return ok(lists)
    } catch (error) {
      return err(dbError('Failed to list whatsapp broadcasts', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppBroadcastListWithRecipients | null>> {
    try {
      const list = await prisma.whatsAppBroadcastList.findFirst({
        where: { id, workspaceId },
        include: detailInclude,
      })
      return ok(list)
    } catch (error) {
      return err(dbError('Failed to find whatsapp broadcast', error))
    }
  },

  async findByIdRaw(id: string): Promise<Result<WhatsAppBroadcastList | null>> {
    try {
      const list = await prisma.whatsAppBroadcastList.findUnique({
        where: { id },
      })
      return ok(list)
    } catch (error) {
      return err(dbError('Failed to find whatsapp broadcast', error))
    }
  },

  async create(
    data: Prisma.WhatsAppBroadcastListUncheckedCreateInput,
    contactIds: string[],
  ): Promise<Result<WhatsAppBroadcastListWithRecipients>> {
    try {
      const list = await prisma.whatsAppBroadcastList.create({
        data: {
          ...data,
          recipients: {
            create: contactIds.map((contactId) => ({ contactId })),
          },
        },
        include: detailInclude,
      })
      return ok(list)
    } catch (error) {
      return err(dbError('Failed to create whatsapp broadcast', error))
    }
  },

  async updateStatus(
    id: string,
    status: WhatsAppBroadcastStatus,
  ): Promise<Result<void>> {
    try {
      await prisma.whatsAppBroadcastList.update({
        where: { id },
        data: { status },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to update whatsapp broadcast status', error))
    }
  },

  async listRecipients(
    broadcastListId: string,
  ): Promise<Result<WhatsAppBroadcastRecipient[]>> {
    try {
      const recipients = await prisma.whatsAppBroadcastRecipient.findMany({
        where: { broadcastListId },
        include: { contact: true },
      })
      return ok(recipients)
    } catch (error) {
      return err(dbError('Failed to list broadcast recipients', error))
    }
  },

  async findRecipientById(id: string): Promise<
    Result<
      | (WhatsAppBroadcastRecipient & {
          contact: { waId: string }
          broadcastList: WhatsAppBroadcastList
        })
      | null
    >
  > {
    try {
      const recipient = await prisma.whatsAppBroadcastRecipient.findUnique({
        where: { id },
        include: { contact: true, broadcastList: true },
      })
      return ok(recipient)
    } catch (error) {
      return err(dbError('Failed to find broadcast recipient', error))
    }
  },

  async updateRecipientStatus(
    id: string,
    data: {
      status: WhatsAppBroadcastRecipientStatus
      providerMessageId?: string
      errorMessage?: string
      sentAt?: Date
    },
  ): Promise<Result<void>> {
    try {
      await prisma.whatsAppBroadcastRecipient.update({ where: { id }, data })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to update broadcast recipient', error))
    }
  },

  async countPendingRecipients(
    broadcastListId: string,
  ): Promise<Result<number>> {
    try {
      const count = await prisma.whatsAppBroadcastRecipient.count({
        where: { broadcastListId, status: 'PENDING' },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count pending recipients', error))
    }
  },

  async countFailedRecipients(
    broadcastListId: string,
  ): Promise<Result<number>> {
    try {
      const count = await prisma.whatsAppBroadcastRecipient.count({
        where: { broadcastListId, status: 'FAILED' },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count failed recipients', error))
    }
  },
}
