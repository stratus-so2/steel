import type { SdKbArticleSummaryDTO, SdKbUserRefDTO } from './sd-kb-article'

/** DTOs do KCS: revisão, validade, reuso e curadoria da base. */

export type SdKbReviewStatusDTO = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED'

export interface SdKbReviewArticleRefDTO {
  id: string
  title: string
  icon: string | null
  status: SdKbArticleSummaryDTO['status']
}

export interface SdKbReviewDTO {
  id: string
  workspaceId: string
  articleId: string
  status: SdKbReviewStatusDTO
  comment: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
  reviewerId: string | null
  reviewer: SdKbUserRefDTO | null
  /** Resumo do artigo revisado (listas de "minhas revisões"). */
  article: SdKbReviewArticleRefDTO | null
}

/** Artigo + a revisão pendente dele (painel do editor). */
export interface SdKbReviewStateDTO {
  articleId: string
  status: SdKbArticleSummaryDTO['status']
  reviewIntervalDays: number | null
  /** Validade efetiva: a do artigo ou o padrão do workspace. */
  effectiveIntervalDays: number
  reviewDueAt: string | null
  lastReviewedAt: string | null
  overdue: boolean
  pending: SdKbReviewDTO | null
  history: SdKbReviewDTO[]
}

export interface SdKbReviewSettingsDTO {
  defaultIntervalDays: number
}

/** Curadoria da base (KCS): o que resolve, o que venceu e o que não pega. */
export interface SdKbStatsTotalsDTO {
  published: number
  inReview: number
  overdue: number
  neverReused: number
  /** Soma de `reuseCount` de todos os artigos do workspace. */
  resolvedTickets: number
}

export interface SdKbStatsResultDTO {
  totals: SdKbStatsTotalsDTO
  mostReused: SdKbArticleSummaryDTO[]
  overdue: SdKbArticleSummaryDTO[]
  neverReused: SdKbArticleSummaryDTO[]
}

/** Resultado de "criar artigo a partir deste chamado". */
export interface SdKbDraftFromTicketDTO {
  article: import('./sd-kb-article').SdKbArticleDTO
  /** `true` quando o rascunho saiu da IA; `false` = só o esqueleto KCS. */
  aiUsed: boolean
  /** Por que a IA não escreveu (desligada, sem cota, provedor fora). */
  aiSkippedReason: string | null
}
