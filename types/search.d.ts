import type {
  SearchEntityType,
  SearchModule,
} from '@/src/lib/search/search-entities'

export type SearchEntityTypeDTO = SearchEntityType

export interface SearchResultDTO {
  type: SearchEntityTypeDTO
  id: string
  title: string
  subtitle: string | null
  /** Short excerpt of the body (ticket description, last message…). */
  snippet: string | null
  /** Absolute app path, already prefixed with the workspace slug. */
  href: string
  module: SearchModule | null
  /** pt-BR group label ("Chamados", "Leads"…). */
  group: string
  score: number
  isMine: boolean
  updatedAt: string
}

export interface SearchResponseDTO {
  query: string
  results: SearchResultDTO[]
  tookMs: number
}
