import type { Prisma, SdAttachmentKind } from '@prisma/client'
import { sdAttachmentNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_ATTACHMENT_INCLUDE } from './sd-ticket-message.repository'

const ATTACHMENT_WITH_MESSAGE = {
  ...SD_ATTACHMENT_INCLUDE,
  message: { select: { visibility: true, deletedAt: true } },
} as const satisfies Prisma.SdTicketAttachmentInclude

export type SdTicketAttachmentWithRelations =
  Prisma.SdTicketAttachmentGetPayload<{
    include: typeof ATTACHMENT_WITH_MESSAGE
  }>

export interface SdTicketAttachmentCreateData {
  id: string
  workspaceId: string
  ticketId: string
  uploadedById: string
  kind: SdAttachmentKind
  fileName: string
  mimeType: string
  size: number
  storageKey: string
}

/** Anexos do chamado (arquivos no MinIO). Sem regra de negócio. */
export const SdTicketAttachmentRepository = {
  async create(
    data: SdTicketAttachmentCreateData,
  ): Promise<Result<SdTicketAttachmentWithRelations>> {
    try {
      const row = await prisma.sdTicketAttachment.create({
        data,
        include: ATTACHMENT_WITH_MESSAGE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk attachment', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTicketAttachmentWithRelations>> {
    try {
      const row = await prisma.sdTicketAttachment.findFirst({
        where: { id, ticketId, deletedAt: null },
        include: ATTACHMENT_WITH_MESSAGE,
      })
      if (!row) return err(sdAttachmentNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk attachment', error))
    }
  },

  /**
   * Anexos vivos do chamado (de mensagens não excluídas ou soltos).
   * `includeInternal: false` → só de mensagens públicas, mais os soltos
   * enviados por `viewerId`.
   */
  async listForTicket(params: {
    ticketId: string
    includeInternal: boolean
    viewerId: string
  }): Promise<Result<SdTicketAttachmentWithRelations[]>> {
    const visible: Prisma.SdTicketAttachmentWhereInput = params.includeInternal
      ? {
          OR: [{ messageId: null }, { message: { deletedAt: null } }],
        }
      : {
          OR: [
            { messageId: null, uploadedById: params.viewerId },
            { message: { deletedAt: null, visibility: 'PUBLIC' } },
          ],
        }
    try {
      const rows = await prisma.sdTicketAttachment.findMany({
        where: { ticketId: params.ticketId, deletedAt: null, ...visible },
        orderBy: { createdAt: 'desc' },
        include: ATTACHMENT_WITH_MESSAGE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk attachments', error))
    }
  },

  /** Anexos soltos (sem mensagem) do chamado, entre os ids dados. */
  async findUnattached(
    ids: string[],
    ticketId: string,
  ): Promise<
    Result<
      { id: string; uploadedById: string | null; kind: SdAttachmentKind }[]
    >
  > {
    if (ids.length === 0) return ok([])
    try {
      const rows = await prisma.sdTicketAttachment.findMany({
        where: {
          id: { in: ids },
          ticketId,
          messageId: null,
          deletedAt: null,
        },
        select: { id: true, uploadedById: true, kind: true },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk attachments', error))
    }
  },

  async softDelete(id: string, at: Date): Promise<Result<void>> {
    try {
      await prisma.sdTicketAttachment.update({
        where: { id },
        data: { deletedAt: at },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk attachment', error))
    }
  },
}
