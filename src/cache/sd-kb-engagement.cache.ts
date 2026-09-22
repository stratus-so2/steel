import { logger } from '@/lib/axiom/logger'
import { ensureRedisConnected } from '@/src/lib/redis'

/**
 * Engajamento dos artigos da KB no Redis, sem tabela nova:
 * - visualização: `sd:kb:view:<articleId>:<userId>:<dia>` com `SET NX` e TTL
 *   de 36 h — conta uma vez por usuário por dia (UTC);
 * - voto: hash `sd:kb:votes:<articleId>` (campo = userId, valor `up`/`down`),
 *   sem TTL — um voto por usuário, que pode trocar ou retirar. Os totais
 *   ficam em `helpful_count`/`not_helpful_count` no Postgres.
 *
 * Falha de Redis não derruba a leitura: a visualização não é contada e o
 * voto é recusado (o service devolve o erro).
 */

export type SdKbVote = 'up' | 'down'

const VIEW_TTL_SECONDS = 36 * 60 * 60

function viewKey(articleId: string, userId: string, day: string): string {
  return `sd:kb:view:${articleId}:${userId}:${day}`
}

function votesKey(articleId: string): string {
  return `sd:kb:votes:${articleId}`
}

function warn(event: string, cause: unknown) {
  logger.warn(event, {
    component: 'SdKbEngagementCache',
    message: cause instanceof Error ? cause.message : String(cause),
  })
}

export const SdKbEngagementCache = {
  /** `true` na primeira visualização do usuário no dia (deve contar). */
  async markViewed(
    articleId: string,
    userId: string,
    now = new Date(),
  ): Promise<boolean> {
    try {
      const client = await ensureRedisConnected()
      const day = now.toISOString().slice(0, 10)
      const set = await client.set(viewKey(articleId, userId, day), '1', {
        NX: true,
        EX: VIEW_TTL_SECONDS,
      })
      return set === 'OK'
    } catch (cause) {
      warn('cache.sd_kb.mark_viewed_failed', cause)
      return false
    }
  },

  async getVote(articleId: string, userId: string): Promise<SdKbVote | null> {
    try {
      const client = await ensureRedisConnected()
      const value = await client.hGet(votesKey(articleId), userId)
      return value === 'up' || value === 'down' ? value : null
    } catch (cause) {
      warn('cache.sd_kb.get_vote_failed', cause)
      return null
    }
  },

  /**
   * Grava (ou retira, com `null`) o voto e devolve o anterior. `undefined`
   * quando o Redis falhou — o chamador não deve mexer nos contadores.
   */
  async swapVote(
    articleId: string,
    userId: string,
    vote: SdKbVote | null,
  ): Promise<SdKbVote | null | undefined> {
    try {
      const client = await ensureRedisConnected()
      const key = votesKey(articleId)
      const previous = await client.hGet(key, userId)
      if (vote) await client.hSet(key, userId, vote)
      else await client.hDel(key, userId)
      return previous === 'up' || previous === 'down' ? previous : null
    } catch (cause) {
      warn('cache.sd_kb.swap_vote_failed', cause)
      return undefined
    }
  },

  /** Limpa votos de um artigo excluído definitivamente. */
  async forgetArticle(articleId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected()
      await client.del(votesKey(articleId))
    } catch (cause) {
      warn('cache.sd_kb.forget_article_failed', cause)
    }
  },
}
