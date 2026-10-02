import { logger } from '@/lib/axiom/logger'
import { ensureRedisConnected } from '@/src/lib/redis'

/**
 * Trava de idempotência dos webhooks de integração, no Redis e sem tabela
 * nova: `sd:integration:event:<kind>:<id>` com `SET NX` e TTL de 2 horas.
 *
 * O Slack reentrega o mesmo evento quando a resposta demora ou falha (até
 * três vezes, e com `event_id` estável), e o GitHub reentrega pelo botão
 * "Redeliver" — a trava garante que o segundo não abre outro chamado nem
 * duplica a mensagem no histórico.
 *
 * Redis indisponível **não** derruba o webhook: o evento é processado (o
 * risco de duplicar é menor que o de perder um chamado) e fica um aviso no
 * log.
 */

/** Cobre com folga a janela de reentrega do Slack e do GitHub. */
const EVENT_TTL_SECONDS = 2 * 60 * 60

function key(kind: string, eventId: string): string {
  return `sd:integration:event:${kind}:${eventId}`
}

export const SdIntegrationEventCache = {
  /** `true` na primeira vez que este evento aparece (deve processar). */
  async claim(kind: string, eventId: string): Promise<boolean> {
    try {
      const client = await ensureRedisConnected()
      const set = await client.set(key(kind, eventId), '1', {
        NX: true,
        EX: EVENT_TTL_SECONDS,
      })
      return set === 'OK'
    } catch (cause) {
      logger.warn('servicedesk.integration.idempotency_unavailable', {
        component: 'SdIntegrationEventCache',
        kind,
        message: cause instanceof Error ? cause.message : String(cause),
      })
      return true
    }
  },

  /** Libera a trava quando o processamento falhou e vale tentar de novo. */
  async release(kind: string, eventId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected()
      await client.del(key(kind, eventId))
    } catch (cause) {
      logger.warn('servicedesk.integration.idempotency_release_failed', {
        component: 'SdIntegrationEventCache',
        kind,
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  },
}
