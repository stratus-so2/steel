import type { Value } from 'platejs'
import {
  sdKbExcerpt,
  sdKbReadingMinutes,
} from '@/src/lib/servicedesk/sd-kb-text'
import type {
  SdKbArticleSummary,
  SdKbArticleWithRefs,
  SdKbSearchRow,
} from '@/src/repositories/sd-kb-article.repository'
import type { SdKbCategoryRow } from '@/src/repositories/sd-kb-catalog.repository'
import type { SdTicketKbLinkWithArticle } from '@/src/repositories/sd-kb-ticket-link.repository'
import type {
  SdKbArticleDTO,
  SdKbArticleSummaryDTO,
  SdKbCategoryDTO,
  SdKbSearchResultDTO,
  SdKbVoteDTO,
  SdTicketKbLinkDTO,
} from '@/types/sd-kb-article'

export function toSdKbArticleSummaryDTO(
  article: SdKbArticleSummary,
): SdKbArticleSummaryDTO {
  return {
    id: article.id,
    workspaceId: article.workspaceId,
    parentId: article.parentId,
    title: article.title,
    icon: article.icon,
    coverImage: article.coverImage,
    status: article.status,
    visibility: article.visibility,
    categoryId: article.categoryId,
    tags: article.tags,
    position: article.position,
    viewCount: article.viewCount,
    helpfulCount: article.helpfulCount,
    notHelpfulCount: article.notHelpfulCount,
    reuseCount: article.reuseCount,
    sourceTicketId: article.sourceTicketId,
    reviewIntervalDays: article.reviewIntervalDays,
    reviewDueAt: article.reviewDueAt?.toISOString() ?? null,
    lastReviewedAt: article.lastReviewedAt?.toISOString() ?? null,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    archivedAt: article.archivedAt?.toISOString() ?? null,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  }
}

export function toSdKbArticleDTO(
  article: SdKbArticleWithRefs,
  myVote: SdKbVoteDTO = null,
): SdKbArticleDTO {
  return {
    ...toSdKbArticleSummaryDTO(article),
    content: article.content as Value,
    readingMinutes: sdKbReadingMinutes(article.plainText),
    createdById: article.createdById,
    updatedById: article.updatedById,
    createdBy: article.createdBy,
    updatedBy: article.updatedBy,
    category: article.category,
    myVote,
  }
}

export function toSdKbSearchResultDTO(
  row: SdKbSearchRow,
  query: string,
): SdKbSearchResultDTO {
  return {
    ...toSdKbArticleSummaryDTO(row),
    excerpt: sdKbExcerpt(row.plainText, query),
    rank: row.rank,
  }
}

export function toSdKbCategoryDTO(row: SdKbCategoryRow): SdKbCategoryDTO {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description,
    parentId: row.parentId,
    articleCount: row.articleCount,
  }
}

export function toSdTicketKbLinkDTO(
  link: SdTicketKbLinkWithArticle,
): SdTicketKbLinkDTO {
  return {
    ticketId: link.ticketId,
    article: toSdKbArticleSummaryDTO(link.article),
    linkedById: link.linkedById,
    resolvedTicket: link.resolvedTicket,
    createdAt: link.createdAt.toISOString(),
  }
}
