import { createHash } from 'node:crypto'
import type { AnalyticsResultDTO } from '@/src/schemas/admin-analytics.schema'
import { createKeyedCache } from './_cache'

/** TTL curto: o painel é quase ao vivo, mas várias abas/admins dividem. */
export const ANALYTICS_CACHE_TTL_SECONDS = 45

/**
 * Resultado de uma aba do painel Analytics por combinação de filtros. Só é
 * gravado quando todos os painéis deram certo (falha não fica em cache).
 */
export const AnalyticsCache = createKeyedCache<AnalyticsResultDTO>({
  prefix: 'analytics:v1:',
  ttl: ANALYTICS_CACHE_TTL_SECONDS,
  name: 'analytics',
})

/** Chave estável para uma aba + filtros (ordem das chaves não importa). */
export function analyticsCacheKey(
  parts: Record<string, string | undefined>,
): string {
  const canonical = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key] ?? ''}`)
    .join('&')
  return createHash('sha1').update(canonical).digest('hex')
}
