import type {
  Prisma,
  SdMessageAuthorKind,
  SdMessageVisibility,
} from '@prisma/client'
import { sdMessageNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_ATTACHMENT_INCLUDE = {
  uploadedBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTicketAttachmentInclude

export const SD_MESSAGE_INCLUDE = {
  authorUser: { select: SD_USER_SUMMARY_SELECT },
  authorContact: { select: { id: true, name: true } },
  attachments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: SD_ATTACHMENT_INCLUDE,
  },
} as const satisfies Prisma.SdTicketMessageInclude

export type SdTicketMessageWithRelations = Prisma.SdTicketMessageGetPayload<{
  include: typeof SD_MESSAGE_INCLUDE
}>

export interface SdTicketMessageCreateData {
  workspaceId: string
  ticketId: string
  authorKind: SdMessageAuthorKind
  authorUserId: string | null
  visibility: SdMessageVisibility
  body: string
  /** Anexos já enviados (soltos) que passam a pertencer à mensagem. */
  attachmentIds: string[]
}

/** Histórico do chamado (`SdTicketMessage`). Sem regra de negócio. */
export const SdTicketMessageRepository = {
  /**
   * Página das mais novas para as mais antigas (`before` = id da mais antiga
   * já carregada). `includeInternal: false` esconde notas internas.
   */
  async list(params: {
    ticketId: string
    includeInternal: boolean
    before?: string
    limit: number
  }): Promise<
    Result<{ items: SdTicketMessageWithRelations[]; hasMore: boolean }>
  > {
    try {
      const rows = await prisma.sdTicketMessage.findMany({
        where: {
          ticketId: params.ticketId,
          deletedAt: null,
          ...(params.includeInternal ? {} : { visibility: 'PUBLIC' }),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: params.limit + 1,
        ...(params.before ? { cursor: { id: params.before }, skip: 1 } : {}),
        include: SD_MESSAGE_INCLUDE,
      })
      return ok({
        items: rows.slice(0, params.limit),
        hasMore: rows.length > params.limit,
      })
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk ticket messages', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTicketMessageWithRelations>> {
    try {
      const row = await prisma.sdTicketMessage.findFirst({
        where: { id, ticketId, deletedAt: null },
        include: SD_MESSAGE_INCLUDE,
      })
      if (!row) return err(sdMessageNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk ticket message', error))
    }
  },

  /** Cria a mensagem e prende os anexos soltos a ela (uma transação). */
  async create(
    data: SdTicketMessageCreateData,
  ): Promise<Result<SdTicketMessageWithRelations>> {
    const { attachmentIds, ...message } = data
    try {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.sdTicketMessage.create({
          data: message,
          select: { id: true },
        })
        if (attachmentIds.length > 0) {
          await tx.sdTicketAttachment.updateMany({
            where: {
              id: { in: attachmentIds },
              ticketId: data.ticketId,
              messageId: null,
              deletedAt: null,
            },
            data: { messageId: created.id },
          })
        }
        return tx.sdTicketMessage.findUniqueOrThrow({
          where: { id: created.id },
          include: SD_MESSAGE_INCLUDE,
        })
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk ticket message', error))
    }
  },

  async updateBody(
    id: string,
    body: string,
    editedAt: Date,
  ): Promise<Result<SdTicketMessageWithRelations>> {
    try {
      const row = await prisma.sdTicketMessage.update({
        where: { id },
        data: { body, editedAt },
        include: SD_MESSAGE_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk ticket message', error))
    }
  },

  /** Exclusão lógica da mensagem e dos anexos dela. */
  async softDelete(id: string, at: Date): Promise<Result<void>> {
    try {
      await prisma.$transaction([
        prisma.sdTicketMessage.update({
          where: { id },
          data: { deletedAt: at },
        }),
        prisma.sdTicketAttachment.updateMany({
          where: { messageId: id, deletedAt: null },
          data: { deletedAt: at },
        }),
      ])
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk ticket message', error))
    }
  },

  /**
   * Quem, entre `userIds`, é agente no workspace: membro de um departamento
   * ativo ou OWNER/ADMIN (usado para não avisar solicitantes de notas
   * internas).
   */
  async filterAgentIds(
    workspaceId: string,
    userIds: string[],
  ): Promise<Result<string[]>> {
    const unique = Array.from(new Set(userIds))
    if (unique.length === 0) return ok([])
    try {
      const [links, admins] = await Promise.all([
        prisma.sdDepartmentMember.findMany({
          where: {
            userId: { in: unique },
            department: { workspaceId, deletedAt: null, active: true },
          },
          select: { userId: true },
        }),
        prisma.membership.findMany({
          where: {
            workspaceId,
            userId: { in: unique },
            role: { in: ['OWNER', 'ADMIN'] },
          },
          select: { userId: true },
        }),
      ])
      const agents = new Set([
        ...links.map((l) => l.userId),
        ...admins.map((a) => a.userId),
      ])
      return ok(unique.filter((id) => agents.has(id)))
    } catch (error) {
      return err(dbError('Failed to resolve ServiceDesk agents', error))
    }
  },
}
