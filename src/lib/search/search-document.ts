import type { ModuleKind } from '@prisma/client'
import type { SearchAudience, SearchEntityType } from './search-entities'

/** One row of `search_documents`, as the indexer writes it. */
export interface SearchDocumentInput {
  workspaceId: string
  entityType: SearchEntityType
  entityId: string
  module: ModuleKind | null
  audience: SearchAudience
  title: string
  subtitle: string | null
  body: string | null
  /** Extra words searchable with top weight (codes, e-mails, tags). */
  keywords: string
  /** Exact-match keys (canonical codes, phone digits, e-mails). */
  codes: string[]
  /** Owner/assignee/requester/participants — boost and `PARTIES` access. */
  userIds: string[]
  /** App path relative to the workspace (`/crm/leads?record=…`). */
  path: string
  updatedAt: Date
}

/** Matched document plus the raw ranking signals computed by Postgres. */
export interface SearchDocumentHit {
  entityType: SearchEntityType
  entityId: string
  module: ModuleKind | null
  title: string
  subtitle: string | null
  body: string | null
  path: string
  updatedAt: Date
  exact: boolean
  titlePrefix: boolean
  titlePhrase: boolean
  textRank: number
  similarity: number
  isMine: boolean
}

export interface SearchDocumentQuery {
  workspaceId: string
  userId: string
  /** Folded query text (see `parseSearchQuery`). */
  text: string
  codes: string[]
  tsquery: string | null
  /** Entity types the user may see; empty = nothing. */
  types: SearchEntityType[]
  /** ServiceDesk agent: sees `AGENTS`/`PARTIES` documents. */
  isSdAgent: boolean
  /** Candidates fetched before the final blend in TypeScript. */
  candidateLimit: number
}

const BODY_MAX = 4000
const SNIPPET_MAX = 160

/** Plain text of rich HTML (ticket descriptions), entities decoded. */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Joins the non-empty parts with ` · `, `null` when nothing is left. */
export function joinParts(
  parts: ReadonlyArray<string | null | undefined | false>,
  separator = ' · ',
): string | null {
  const kept = parts
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter(Boolean)
  return kept.length ? kept.join(separator) : null
}

export function clampBody(value: string | null | undefined): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > BODY_MAX ? text.slice(0, BODY_MAX) : text
}

export function snippetOf(value: string | null | undefined): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > SNIPPET_MAX
    ? `${text.slice(0, SNIPPET_MAX - 1).trimEnd()}…`
    : text
}

/** Distinct, non-empty user ids. */
export function userIdsOf(
  ids: ReadonlyArray<string | null | undefined>,
): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))]
}
