import { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type {
  SearchDocumentHit,
  SearchDocumentInput,
  SearchDocumentQuery,
} from '@/src/lib/search/search-document'
import type { SearchEntityType } from '@/src/lib/search/search-entities'
import { dbError } from './db-error'

/**
 * `search_documents` — the denormalized index behind the global search.
 * `search_vector` (Portuguese stemming + unaccent, weights A/B/C) and
 * `title_norm` (lower + unaccent, pg_trgm GIN) are generated columns, so
 * this repository only writes the source fields. Retrieval never scans:
 * every match predicate is served by a GIN index (tsvector, trigram or the
 * `codes` array); ranking signals are computed on the candidates only.
 */

/** Below this pg_trgm word similarity a fuzzy-only match is dropped. */
export const SEARCH_TRGM_THRESHOLD = 0.45

interface HitRow {
  entity_type: string
  entity_id: string
  module: string | null
  title: string
  subtitle: string | null
  body: string | null
  path: string
  updated_at: Date
  exact: boolean
  title_prefix: boolean
  title_phrase: boolean
  text_rank: number
  similarity: number
  is_mine: boolean
}

function toRecordset(docs: readonly SearchDocumentInput[]): string {
  return JSON.stringify(
    docs.map((d) => ({
      workspace_id: d.workspaceId,
      entity_type: d.entityType,
      entity_id: d.entityId,
      module: d.module,
      audience: d.audience,
      title: d.title,
      subtitle: d.subtitle,
      body: d.body,
      keywords: d.keywords,
      codes: d.codes,
      user_ids: d.userIds,
      path: d.path,
      updated_at: d.updatedAt.toISOString(),
    })),
  )
}

export const SearchDocumentRepository = {
  /**
   * Database clock — the reindex compares it with `indexed_at` (set by the
   * database), so app/DB clock skew can never delete fresh documents.
   */
  async now(): Promise<Result<Date>> {
    try {
      const rows = await prisma.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp() AS now`
      return ok(rows[0].now)
    } catch (error) {
      return err(dbError('Failed to read the database clock', error))
    }
  },

  /** Inserts or refreshes the documents; stamps `indexed_at = now()`. */
  async upsertMany(
    docs: readonly SearchDocumentInput[],
  ): Promise<Result<number>> {
    if (docs.length === 0) return ok(0)
    try {
      const count = await prisma.$executeRaw`
        INSERT INTO search_documents (
          workspace_id, entity_type, entity_id, module, audience, title,
          subtitle, body, keywords, codes, user_ids, path, updated_at,
          indexed_at
        )
        SELECT
          x.workspace_id, x.entity_type, x.entity_id, x.module, x.audience,
          x.title, x.subtitle, x.body, x.keywords, x.codes, x.user_ids,
          x.path, x.updated_at, now()
        FROM jsonb_to_recordset(${toRecordset(docs)}::jsonb) AS x(
          workspace_id text, entity_type text, entity_id text, module text,
          audience text, title text, subtitle text, body text, keywords text,
          codes text[], user_ids text[], path text, updated_at timestamptz
        )
        ON CONFLICT (workspace_id, entity_type, entity_id) DO UPDATE SET
          module = EXCLUDED.module,
          audience = EXCLUDED.audience,
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          body = EXCLUDED.body,
          keywords = EXCLUDED.keywords,
          codes = EXCLUDED.codes,
          user_ids = EXCLUDED.user_ids,
          path = EXCLUDED.path,
          updated_at = EXCLUDED.updated_at,
          indexed_at = now()
      `
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to upsert search documents', error))
    }
  },

  async removeMany(
    workspaceId: string,
    entityType: SearchEntityType,
    entityIds: readonly string[],
  ): Promise<Result<number>> {
    if (entityIds.length === 0) return ok(0)
    try {
      const count = await prisma.$executeRaw`
        DELETE FROM search_documents
        WHERE workspace_id = ${workspaceId}
          AND entity_type = ${entityType}
          AND entity_id = ANY(${[...entityIds]}::text[])
      `
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to remove search documents', error))
    }
  },

  /**
   * Drops the documents of one entity type a full reindex did not touch
   * (records deleted while the hooks were not looking).
   */
  async removeStale(
    workspaceId: string,
    entityType: SearchEntityType,
    indexedBefore: Date,
  ): Promise<Result<number>> {
    try {
      const count = await prisma.$executeRaw`
        DELETE FROM search_documents
        WHERE workspace_id = ${workspaceId}
          AND entity_type = ${entityType}
          AND indexed_at < ${indexedBefore}
      `
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to remove stale search documents', error))
    }
  },

  async search(q: SearchDocumentQuery): Promise<Result<SearchDocumentHit[]>> {
    if (q.types.length === 0 || !q.text) return ok([])
    const tsq = q.tsquery
      ? Prisma.sql`to_tsquery('portuguese', ${q.tsquery})`
      : Prisma.sql`NULL::tsquery`
    try {
      const [, rows] = await prisma.$transaction([
        prisma.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(SEARCH_TRGM_THRESHOLD)}, true)`,
        prisma.$queryRaw<HitRow[]>`
          WITH params AS (
            SELECT lower(f_unaccent(${q.text})) AS norm, ${tsq} AS tsq
          ), candidates AS (
            -- Stage 1: index-served match + cheap signals, bounded pool.
            SELECT
              d.entity_type, d.entity_id, d.module, d.title, d.subtitle,
              d.body, d.path, d.updated_at, d.title_norm,
              (d.codes && ${q.codes}::text[] OR d.title_norm = p.norm) AS exact,
              starts_with(d.title_norm, p.norm) AS title_prefix,
              strpos(d.title_norm, p.norm) > 0 AS title_phrase,
              CASE
                WHEN p.tsq IS NOT NULL AND d.search_vector @@ p.tsq
                  THEN ts_rank(d.search_vector, p.tsq, 32)
                ELSE 0
              END::float8 AS text_rank,
              (${q.userId} = ANY(d.user_ids)) AS is_mine
            FROM search_documents d, params p
            WHERE d.workspace_id = ${q.workspaceId}
              AND d.entity_type = ANY(${q.types}::text[])
              AND (
                d.audience = 'PUBLIC'
                OR ${q.isSdAgent}::boolean
                OR (d.audience = 'PARTIES' AND d.user_ids @> ARRAY[${q.userId}]::text[])
              )
              AND (
                (p.tsq IS NOT NULL AND d.search_vector @@ p.tsq)
                OR d.codes && ${q.codes}::text[]
                OR p.norm <% d.title_norm
              )
            ORDER BY exact DESC, title_prefix DESC, title_phrase DESC,
              text_rank DESC, d.updated_at DESC
            LIMIT ${q.candidateLimit}
          )
          -- Stage 2: typo similarity only for the pool.
          SELECT c.*, word_similarity(p.norm, c.title_norm)::float8 AS similarity
          FROM candidates c, params p
        `,
      ])
      return ok(
        rows.map((r) => ({
          entityType: r.entity_type as SearchEntityType,
          entityId: r.entity_id,
          module: r.module as SearchDocumentHit['module'],
          title: r.title,
          subtitle: r.subtitle,
          body: r.body,
          path: r.path,
          updatedAt: r.updated_at,
          exact: r.exact,
          titlePrefix: r.title_prefix,
          titlePhrase: r.title_phrase,
          textRank: Number(r.text_rank),
          similarity: Number(r.similarity),
          isMine: r.is_mine,
        })),
      )
    } catch (error) {
      return err(dbError('Failed to search documents', error))
    }
  },
}
