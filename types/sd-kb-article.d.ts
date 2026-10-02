import type { Value } from 'platejs'

export type SdKbArticleStatusDTO = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'
export type SdKbVisibilityDTO = 'INTERNAL' | 'PORTAL'
export type SdKbVoteDTO = 'up' | 'down' | null

export interface SdKbUserRefDTO {
  id: string
  name: string
  image: string | null
}

export interface SdKbCategoryRefDTO {
  id: string
  name: string
  icon: string | null
}

/** Item da árvore, das listas e da busca (sem o conteúdo do editor). */
export interface SdKbArticleSummaryDTO {
  id: string
  workspaceId: string
  parentId: string | null
  title: string
  icon: string | null
  coverImage: string | null
  status: SdKbArticleStatusDTO
  visibility: SdKbVisibilityDTO
  categoryId: string | null
  tags: string[]
  position: number
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  /** KCS: quantas vezes o artigo resolveu um chamado. */
  reuseCount: number
  /** Chamado que originou o artigo, quando foi criado a partir de um. */
  sourceTicketId: string | null
  /** Validade da revisão (em dias) e quando ela cai. */
  reviewIntervalDays: number | null
  reviewDueAt: string | null
  lastReviewedAt: string | null
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Artigo completo (editor e leitura). */
export interface SdKbArticleDTO extends SdKbArticleSummaryDTO {
  content: Value
  /** Minutos estimados de leitura (200 palavras/min, mínimo 1). */
  readingMinutes: number
  createdById: string | null
  updatedById: string | null
  createdBy: SdKbUserRefDTO | null
  updatedBy: SdKbUserRefDTO | null
  category: SdKbCategoryRefDTO | null
  /** Voto do usuário que leu (preenchido por `getById`). */
  myVote: SdKbVoteDTO
}

export interface SdKbSearchResultDTO extends SdKbArticleSummaryDTO {
  /** Trecho do texto em volta do termo buscado. */
  excerpt: string
  rank: number
}

export interface SdKbCategoryDTO extends SdKbCategoryRefDTO {
  description: string | null
  parentId: string | null
  /** Artigos visíveis para quem consultou (publicados/portal p/ solicitante). */
  articleCount: number
}

export interface SdKbVoteResultDTO {
  helpfulCount: number
  notHelpfulCount: number
  myVote: SdKbVoteDTO
}

export interface SdTicketKbLinkDTO {
  ticketId: string
  article: SdKbArticleSummaryDTO
  linkedById: string | null
  /** O artigo resolveu este chamado — é o que conta no reuso (KCS). */
  resolvedTicket: boolean
  createdAt: string
}

export interface SdKbMentionableMemberDTO {
  userId: string
  name: string
  image: string | null
}
