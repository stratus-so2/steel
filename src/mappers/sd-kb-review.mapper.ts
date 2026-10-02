import {
  sdKcsEffectiveInterval,
  sdKcsReviewOverdue,
} from '@/src/lib/servicedesk/kcs'
import type { SdKbArticleSummary } from '@/src/repositories/sd-kb-article.repository'
import type {
  SdKbReviewWithRefs,
  SdKbStatsRows,
} from '@/src/repositories/sd-kb-review.repository'
import type {
  SdKbReviewDTO,
  SdKbReviewSettingsDTO,
  SdKbReviewStateDTO,
  SdKbStatsResultDTO,
} from '@/types/sd-kb-review'
import { toSdKbArticleSummaryDTO } from './sd-kb-article.mapper'

/** `SdKbReview` → DTO da revisão (com o revisor e o artigo resumidos). */
export function toSdKbReviewDTO(review: SdKbReviewWithRefs): SdKbReviewDTO {
  return {
    id: review.id,
    workspaceId: review.workspaceId,
    articleId: review.articleId,
    status: review.status,
    comment: review.comment,
    decidedAt: review.decidedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    reviewerId: review.reviewerId,
    reviewer: review.reviewer,
    article: review.article,
  }
}

/** Estado da revisão do artigo (painel do editor). */
export function toSdKbReviewStateDTO(input: {
  article: Pick<
    SdKbArticleSummary,
    'id' | 'status' | 'reviewIntervalDays' | 'reviewDueAt' | 'lastReviewedAt'
  >
  workspaceIntervalDays: number
  pending: SdKbReviewWithRefs | null
  history: SdKbReviewWithRefs[]
  now?: Date
}): SdKbReviewStateDTO {
  const { article } = input
  return {
    articleId: article.id,
    status: article.status,
    reviewIntervalDays: article.reviewIntervalDays,
    effectiveIntervalDays: sdKcsEffectiveInterval(
      article.reviewIntervalDays,
      input.workspaceIntervalDays,
    ),
    reviewDueAt: article.reviewDueAt?.toISOString() ?? null,
    lastReviewedAt: article.lastReviewedAt?.toISOString() ?? null,
    overdue: sdKcsReviewOverdue(article.reviewDueAt, input.now ?? new Date()),
    pending: input.pending ? toSdKbReviewDTO(input.pending) : null,
    history: input.history.map(toSdKbReviewDTO),
  }
}

export function toSdKbReviewSettingsDTO(
  defaultIntervalDays: number,
): SdKbReviewSettingsDTO {
  return { defaultIntervalDays }
}

/** Curadoria da base: totais + rankings de reuso, vencidos e sem reuso. */
export function toSdKbStatsDTO(rows: SdKbStatsRows): SdKbStatsResultDTO {
  return {
    totals: {
      published: rows.published,
      inReview: rows.inReview,
      overdue: rows.overdue,
      neverReused: rows.neverReused,
      resolvedTickets: rows.resolvedTickets,
    },
    mostReused: rows.mostReused.map(toSdKbArticleSummaryDTO),
    overdue: rows.overdueArticles.map(toSdKbArticleSummaryDTO),
    neverReused: rows.neverReusedArticles.map(toSdKbArticleSummaryDTO),
  }
}
