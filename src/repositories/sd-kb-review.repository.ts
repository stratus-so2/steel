import type { Prisma, SdKbReviewStatus, SdTicketKbLink } from '@prisma/client'
import { sdKbArticleNotFound, sdKbReviewNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import {
  SD_KB_ARTICLE_INCLUDE,
  SD_KB_SUMMARY_SELECT,
  type SdKbArticleSummary,
  type SdKbArticleWithRefs,
} from './sd-kb-article.repository'

/**
 * Acesso do KCS: revisões do artigo (`SdKbReview`), o ciclo de vida da
 * revisão no próprio artigo (status, validade, carimbos) e a métrica de
 * reuso — o contador de chamados resolvidos, que anda junto com o marcador
 * `resolvedTicket` do vínculo, numa transação.
 */

const reviewerRef = { select: { id: true, name: true, image: true } } as const
const articleRef = {
  select: { id: true, title: true, icon: true, status: true },
} as const

const REVIEW_INCLUDE = {
  reviewer: reviewerRef,
  article: articleRef,
} as const

export type SdKbReviewWithRefs = Prisma.SdKbReviewGetPayload<{
  include: typeof REVIEW_INCLUDE
}>

export interface SdKbArticleMaintainerRow {
  id: string
  workspaceId: string
  title: string
  reviewDueAt: Date | null
  /** Quem mantém o artigo: autor e último editor (pode ser o mesmo). */
  createdById: string | null
  updatedById: string | null
}

export interface SdKbStatsRows {
  published: number
  inReview: number
  overdue: number
  neverReused: number
  resolvedTickets: number
  mostReused: SdKbArticleSummary[]
  overdueArticles: SdKbArticleSummary[]
  neverReusedArticles: SdKbArticleSummary[]
}

/** Vínculo + artigo, como o mapper do KCS espera. */
export type SdKbResolvedLink = SdTicketKbLink & {
  article: SdKbArticleSummary
}

export const SdKbReviewRepository = {
  /* ------------------------------- revisões ------------------------------ */

  async create(data: {
    workspaceId: string
    articleId: string
    reviewerId: string
    comment?: string | null
  }): Promise<Result<SdKbReviewWithRefs>> {
    try {
      const review = await prisma.sdKbReview.create({
        data: {
          workspaceId: data.workspaceId,
          articleId: data.articleId,
          reviewerId: data.reviewerId,
          comment: data.comment ?? null,
        },
        include: REVIEW_INCLUDE,
      })
      return ok(review)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk KB review', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdKbReviewWithRefs>> {
    try {
      const review = await prisma.sdKbReview.findFirst({
        where: { id, workspaceId },
        include: REVIEW_INCLUDE,
      })
      if (!review) return err(sdKbReviewNotFound())
      return ok(review)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk KB review', error))
    }
  },

  /** Revisão pendente do artigo (no máximo uma por vez). */
  async findPendingByArticle(
    articleId: string,
  ): Promise<Result<SdKbReviewWithRefs | null>> {
    try {
      const review = await prisma.sdKbReview.findFirst({
        where: { articleId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: REVIEW_INCLUDE,
      })
      return ok(review)
    } catch (error) {
      return err(dbError('Failed to find pending ServiceDesk KB review', error))
    }
  },

  async listByArticle(
    articleId: string,
    limit = 20,
  ): Promise<Result<SdKbReviewWithRefs[]>> {
    try {
      const rows = await prisma.sdKbReview.findMany({
        where: { articleId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: REVIEW_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk KB reviews', error))
    }
  },

  async listByWorkspace(
    workspaceId: string,
    filters: {
      status?: SdKbReviewStatus
      reviewerId?: string
      limit: number
    },
  ): Promise<Result<SdKbReviewWithRefs[]>> {
    try {
      const rows = await prisma.sdKbReview.findMany({
        where: {
          workspaceId,
          status: filters.status,
          reviewerId: filters.reviewerId,
          article: { archivedAt: null },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: filters.limit,
        include: REVIEW_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(
        dbError('Failed to list workspace ServiceDesk KB reviews', error),
      )
    }
  },

  /** Decide a revisão pendente (aprovar ou pedir mudanças). */
  async decide(
    id: string,
    data: {
      status: Extract<SdKbReviewStatus, 'APPROVED' | 'CHANGES_REQUESTED'>
      comment: string | null
      decidedAt: Date
    },
  ): Promise<Result<SdKbReviewWithRefs>> {
    try {
      const review = await prisma.sdKbReview.update({
        where: { id },
        data,
        include: REVIEW_INCLUDE,
      })
      return ok(review)
    } catch (error) {
      return err(dbError('Failed to decide ServiceDesk KB review', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdKbReview.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk KB review', error))
    }
  },

  /* ------------------------- ciclo de vida do artigo --------------------- */

  /** Manda para revisão (`IN_REVIEW`), sem mexer em `publishedAt`. */
  async markInReview(
    articleId: string,
    updatedById: string,
  ): Promise<Result<SdKbArticleWithRefs>> {
    return updateArticle(articleId, { status: 'IN_REVIEW', updatedById })
  },

  /** Pedido de mudanças: volta ao rascunho. */
  async markDraft(
    articleId: string,
    updatedById: string,
  ): Promise<Result<SdKbArticleWithRefs>> {
    return updateArticle(articleId, { status: 'DRAFT', updatedById })
  },

  /**
   * Aprovação: publica, carimba a revisão e agenda a próxima
   * (`reviewDueAt = null` quando o artigo não tem validade).
   */
  async publishReviewed(
    articleId: string,
    data: {
      updatedById: string
      reviewedAt: Date
      reviewDueAt: Date | null
      reviewIntervalDays: number | null
    },
  ): Promise<Result<SdKbArticleWithRefs>> {
    return updateArticle(articleId, {
      status: 'PUBLISHED',
      publishedAt: data.reviewedAt,
      lastReviewedAt: data.reviewedAt,
      reviewDueAt: data.reviewDueAt,
      reviewIntervalDays: data.reviewIntervalDays,
      updatedById: data.updatedById,
    })
  },

  /** Troca a validade do artigo e, se ele já foi revisado, o próximo prazo. */
  async setReviewInterval(
    articleId: string,
    data: {
      reviewIntervalDays: number | null
      reviewDueAt: Date | null
      updatedById: string
    },
  ): Promise<Result<SdKbArticleWithRefs>> {
    return updateArticle(articleId, data)
  },

  /* --------------------------------- reuso ------------------------------- */

  /**
   * Marca/desmarca o artigo como o que resolveu o chamado e move
   * `reuseCount` no mesmo movimento, numa transação. Idempotente: marcar
   * duas vezes conta uma só (`changed: false`), e o contador nunca passa de
   * zero para baixo.
   */
  async markResolved(
    ticketId: string,
    articleId: string,
    resolved: boolean,
  ): Promise<Result<{ link: SdKbResolvedLink; changed: boolean }>> {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const current = await tx.sdTicketKbLink.findUnique({
          where: { ticketId_articleId: { ticketId, articleId } },
          select: { resolvedTicket: true },
        })
        if (!current) return null
        const changed = current.resolvedTicket !== resolved
        if (changed) {
          await tx.sdKbArticle.update({
            where: { id: articleId },
            data: {
              reuseCount: resolved ? { increment: 1 } : { decrement: 1 },
            },
          })
          // Guarda-chuva: contador nunca negativo (vínculo antigo marcado à
          // mão, artigo recriado, corrida entre dois agentes).
          await tx.sdKbArticle.updateMany({
            where: { id: articleId, reuseCount: { lt: 0 } },
            data: { reuseCount: 0 },
          })
        }
        const link = await tx.sdTicketKbLink.update({
          where: { ticketId_articleId: { ticketId, articleId } },
          data: { resolvedTicket: resolved },
          include: { article: { select: SD_KB_SUMMARY_SELECT } },
        })
        return { link, changed }
      })
      if (!outcome) return err(sdKbArticleNotFound())
      return ok(outcome)
    } catch (error) {
      return err(
        dbError('Failed to mark ServiceDesk KB article as resolver', error),
      )
    }
  },

  /* ----------------------------- curadoria ------------------------------- */

  /** Artigos publicados com a revisão vencida, com quem os mantém. */
  async listOverdue(
    workspaceId: string,
    now: Date,
    limit = 200,
  ): Promise<Result<SdKbArticleMaintainerRow[]>> {
    try {
      const rows = await prisma.sdKbArticle.findMany({
        where: {
          workspaceId,
          status: 'PUBLISHED',
          archivedAt: null,
          reviewDueAt: { not: null, lte: now },
        },
        select: {
          id: true,
          workspaceId: true,
          title: true,
          reviewDueAt: true,
          createdById: true,
          updatedById: true,
        },
        orderBy: { reviewDueAt: 'asc' },
        take: limit,
      })
      return ok(rows)
    } catch (error) {
      return err(
        dbError('Failed to list overdue ServiceDesk KB articles', error),
      )
    }
  },

  /** Painel de curadoria: totais e os três rankings. */
  async stats(
    workspaceId: string,
    now: Date,
    limit: number,
  ): Promise<Result<SdKbStatsRows>> {
    try {
      const live = { workspaceId, archivedAt: null } as const
      const overdueWhere = {
        ...live,
        status: 'PUBLISHED',
        reviewDueAt: { not: null, lte: now },
      } as const
      const neverReusedWhere = {
        ...live,
        status: 'PUBLISHED',
        reuseCount: 0,
      } as const
      const [
        published,
        inReview,
        overdue,
        neverReused,
        sum,
        mostReused,
        overdueArticles,
        neverReusedArticles,
      ] = await Promise.all([
        prisma.sdKbArticle.count({ where: { ...live, status: 'PUBLISHED' } }),
        prisma.sdKbArticle.count({ where: { ...live, status: 'IN_REVIEW' } }),
        prisma.sdKbArticle.count({ where: overdueWhere }),
        prisma.sdKbArticle.count({ where: neverReusedWhere }),
        prisma.sdKbArticle.aggregate({
          where: live,
          _sum: { reuseCount: true },
        }),
        prisma.sdKbArticle.findMany({
          where: { ...live, reuseCount: { gt: 0 } },
          select: SD_KB_SUMMARY_SELECT,
          orderBy: [{ reuseCount: 'desc' }, { updatedAt: 'desc' }],
          take: limit,
        }),
        prisma.sdKbArticle.findMany({
          where: overdueWhere,
          select: SD_KB_SUMMARY_SELECT,
          orderBy: { reviewDueAt: 'asc' },
          take: limit,
        }),
        prisma.sdKbArticle.findMany({
          where: neverReusedWhere,
          select: SD_KB_SUMMARY_SELECT,
          orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
          take: limit,
        }),
      ])
      return ok({
        published,
        inReview,
        overdue,
        neverReused,
        resolvedTickets: sum._sum.reuseCount ?? 0,
        mostReused,
        overdueArticles,
        neverReusedArticles,
      })
    } catch (error) {
      return err(dbError('Failed to read ServiceDesk KB stats', error))
    }
  },
}

async function updateArticle(
  articleId: string,
  data: Prisma.SdKbArticleUncheckedUpdateInput,
): Promise<Result<SdKbArticleWithRefs>> {
  try {
    const article = await prisma.sdKbArticle.update({
      where: { id: articleId },
      data,
      include: SD_KB_ARTICLE_INCLUDE,
    })
    return ok(article)
  } catch (error) {
    return err(
      dbError('Failed to update ServiceDesk KB article lifecycle', error),
    )
  }
}
