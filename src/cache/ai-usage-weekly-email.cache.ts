import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { ensureRedisConnected } from '@/src/lib/redis'

/**
 * Sent-marker of the weekly Steel AI usage e-mail, one per workspace, week
 * and recipient: `ai:usage-weekly-email:<workspaceId>:<YYYY-MM-DD>:<userId>`
 * (`SET NX`, 14-day TTL). Claimed right before sending and released if the
 * send fails, so a retried or re-enqueued job never mails the same owner
 * twice for the same week.
 */

/** Two weeks: past any retry or a late re-run of the same week. */
const MARKER_TTL_SECONDS = 14 * 24 * 60 * 60

export type AiUsageWeeklyEmailClaim = 'claimed' | 'already_sent' | 'unavailable'

export function aiUsageWeeklyEmailMarkerKey(
  workspaceId: string,
  weekKey: string,
  userId: string,
): string {
  return `ai:usage-weekly-email:${workspaceId}:${weekKey}:${userId}`
}

export const AiUsageWeeklyEmailCache = {
  /**
   * `claimed` = first time (send it); `already_sent` = someone did; and
   * `unavailable` when Redis is down — the caller must not send then (it
   * fails the job so BullMQ retries later).
   */
  async claim(
    workspaceId: string,
    weekKey: string,
    userId: string,
  ): Promise<AiUsageWeeklyEmailClaim> {
    try {
      const client = await ensureRedisConnected()
      const set = await client.set(
        aiUsageWeeklyEmailMarkerKey(workspaceId, weekKey, userId),
        new Date().toISOString(),
        { NX: true, EX: MARKER_TTL_SECONDS },
      )
      return set === 'OK' ? 'claimed' : 'already_sent'
    } catch (cause) {
      logger.warn(
        'ai.usage_weekly_email.marker_unavailable',
        logFields(
          {
            component: 'AiUsageWeeklyEmailCache',
            workspaceId,
            message: cause instanceof Error ? cause.message : String(cause),
          },
          { weekKey },
        ),
      )
      return 'unavailable'
    }
  },

  /** Frees the marker after a failed send, so the retry can try again. */
  async release(
    workspaceId: string,
    weekKey: string,
    userId: string,
  ): Promise<void> {
    try {
      const client = await ensureRedisConnected()
      await client.del(
        aiUsageWeeklyEmailMarkerKey(workspaceId, weekKey, userId),
      )
    } catch (cause) {
      logger.warn(
        'ai.usage_weekly_email.marker_release_failed',
        logFields(
          {
            component: 'AiUsageWeeklyEmailCache',
            workspaceId,
            message: cause instanceof Error ? cause.message : String(cause),
          },
          { weekKey },
        ),
      )
    }
  },
}
