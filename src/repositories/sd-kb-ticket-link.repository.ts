import type { SdTicket, SdTicketKbLink } from '@prisma/client'
import { sdTicketNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import {
  SD_KB_SUMMARY_SELECT,
  type SdKbArticleSummary,
} from './sd-kb-article.repository'

/** Campos do chamado que a KB precisa (acesso e sugestão). */
export type SdKbTicketRef = Pick<
  SdTicket,
  | 'id'
  | 'workspaceId'
  | 'title'
  | 'categoryId'
  | 'subcategoryId'
  | 'serviceId'
  | 'requesterId'
  | 'createdById'
  | 'tags'
> & { participantIds: string[] }

export type SdTicketKbLinkWithArticle = SdTicketKbLink & {
  article: SdKbArticleSummary
}

export const SdKbTicketLinkRepository = {
  /** Chamado vivo (não excluído) do workspace. */
  async findTicket(
    ticketId: string,
    workspaceId: string,
  ): Promise<Result<SdKbTicketRef>> {
    try {
      const ticket = await prisma.sdTicket.findFirst({
        where: { id: ticketId, workspaceId, deletedAt: null },
        select: {
          id: true,
          workspaceId: true,
          title: true,
          categoryId: true,
          subcategoryId: true,
          serviceId: true,
          requesterId: true,
          createdById: true,
          tags: true,
          participants: { select: { userId: true } },
        },
      })
      if (!ticket) return err(sdTicketNotFound())
      const { participants, ...rest } = ticket
      return ok({ ...rest, participantIds: participants.map((p) => p.userId) })
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk ticket for KB', error))
    }
  },

  async listByTicket(
    ticketId: string,
    filters: { portalOnly: boolean },
  ): Promise<Result<SdTicketKbLinkWithArticle[]>> {
    try {
      const rows = await prisma.sdTicketKbLink.findMany({
        where: {
          ticketId,
          article: {
            archivedAt: null,
            ...(filters.portalOnly
              ? { status: 'PUBLISHED', visibility: 'PORTAL' }
              : {}),
          },
        },
        include: { article: { select: SD_KB_SUMMARY_SELECT } },
        orderBy: { createdAt: 'asc' },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk ticket KB links', error))
    }
  },

  /** Idempotente: vincular de novo mantém o vínculo original. */
  async link(data: {
    ticketId: string
    articleId: string
    linkedById: string
  }): Promise<Result<SdTicketKbLinkWithArticle>> {
    try {
      const row = await prisma.sdTicketKbLink.upsert({
        where: {
          ticketId_articleId: {
            ticketId: data.ticketId,
            articleId: data.articleId,
          },
        },
        create: data,
        update: {},
        include: { article: { select: SD_KB_SUMMARY_SELECT } },
      })
      return ok(row)
    } catch (error) {
      return err(
        dbError('Failed to link KB article to ServiceDesk ticket', error),
      )
    }
  },

  /** Idempotente: desvincular o que não existe não é erro. */
  async unlink(ticketId: string, articleId: string): Promise<Result<void>> {
    try {
      await prisma.sdTicketKbLink.deleteMany({ where: { ticketId, articleId } })
      return ok(undefined)
    } catch (error) {
      return err(
        dbError('Failed to unlink KB article from ServiceDesk ticket', error),
      )
    }
  },
}
