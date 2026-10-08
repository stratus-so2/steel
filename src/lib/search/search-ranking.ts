/**
 * E-commerce style ranking for the global search. Postgres returns, for
 * each candidate, the raw match signals; this module blends them into one
 * score. Tiers dominate (an exact code always beats a prefix, a prefix
 * always beats a fuzzy match) and, inside a tier, text relevance, typo
 * similarity, recency and "it is mine" break the tie.
 */

export interface SearchHitSignals {
  /** Code/number/e-mail/phone equal to the query, or the whole title. */
  exact: boolean
  /** Title starts with the query. */
  titlePrefix: boolean
  /** The query appears verbatim inside the title. */
  titlePhrase: boolean
  /** `ts_rank(..., 32)`, already normalized to 0..1. */
  textRank: number
  /** pg_trgm `word_similarity(query, title)`, 0..1 — typo tolerance. */
  similarity: number
  updatedAt: Date
  /** The user is the owner/assignee/requester of the record. */
  isMine: boolean
}

export const SEARCH_WEIGHTS = {
  exact: 1000,
  titlePrefix: 300,
  titlePhrase: 150,
  textRank: 100,
  similarity: 60,
  /** Boost of a record touched right now; halves every `recencyHalfLifeDays`. */
  recency: 12,
  recencyHalfLifeDays: 30,
  mine: 20,
} as const

const DAY_MS = 86_400_000

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return value > 1 ? 1 : value
}

export function recencyBoost(updatedAt: Date, now: Date): number {
  const days = Math.max(0, (now.getTime() - updatedAt.getTime()) / DAY_MS)
  return (
    SEARCH_WEIGHTS.recency * 0.5 ** (days / SEARCH_WEIGHTS.recencyHalfLifeDays)
  )
}

export function scoreSearchHit(signals: SearchHitSignals, now: Date): number {
  let score = 0
  if (signals.exact) score += SEARCH_WEIGHTS.exact
  if (signals.titlePrefix) score += SEARCH_WEIGHTS.titlePrefix
  else if (signals.titlePhrase) score += SEARCH_WEIGHTS.titlePhrase
  score += SEARCH_WEIGHTS.textRank * clamp01(signals.textRank)
  score += SEARCH_WEIGHTS.similarity * clamp01(signals.similarity)
  score += recencyBoost(signals.updatedAt, now)
  if (signals.isMine) score += SEARCH_WEIGHTS.mine
  return Math.round(score * 1000) / 1000
}

export interface RankableHit {
  entityType: string
  entityId: string
  signals: SearchHitSignals
}

/**
 * Scores, dedupes (same `entityType:entityId` keeps its best score), sorts
 * by score (newest first on ties) and cuts at `limit`.
 */
export function rankSearchHits<T extends RankableHit>(
  hits: readonly T[],
  now: Date,
  limit: number,
): Array<T & { score: number }> {
  const best = new Map<string, T & { score: number }>()
  for (const hit of hits) {
    const key = `${hit.entityType}:${hit.entityId}`
    const scored = { ...hit, score: scoreSearchHit(hit.signals, now) }
    const current = best.get(key)
    if (!current || scored.score > current.score) best.set(key, scored)
  }
  return [...best.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.signals.updatedAt.getTime() - a.signals.updatedAt.getTime(),
    )
    .slice(0, limit)
}
