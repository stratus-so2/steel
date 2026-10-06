import type { AiModelPricing } from './models'
import type { AiUsageTokens } from './types'

/**
 * Matemática da cota de IA (pura, sem I/O). Regra de custo (ADR 0019):
 * custo = (entrada não cacheada × preço de entrada + entrada cacheada ×
 * preço de cache + saída × preço de saída) / 1.000.000 × margem da
 * plataforma, com o preço oficial do modelo (`AI_MODEL_CATALOG`).
 */

/** Arredonda para 6 casas (precisão da coluna `ai_usage.cost_usd`). */
function roundMicros(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

/**
 * Real cost of a call in US$. `cachedInputTokens` is a subset of
 * `inputTokens`; without a cached price it is billed as regular input.
 */
export function priceAiUsage(
  pricing: AiModelPricing,
  usage: AiUsageTokens,
  margin = 1,
): number {
  const input = Math.max(0, usage.inputTokens)
  const output = Math.max(0, usage.outputTokens)
  const cached = Math.min(input, Math.max(0, usage.cachedInputTokens ?? 0))
  const cachedPrice = pricing.cachedInputUsdPer1M ?? pricing.inputUsdPer1M
  const usd =
    ((input - cached) * pricing.inputUsdPer1M +
      cached * cachedPrice +
      output * pricing.outputUsdPer1M) /
    1_000_000
  return roundMicros(usd * Math.max(0, margin))
}

/** Adds one provider call's usage to a running total (in place). */
export function addAiUsage(total: AiUsageTokens, delta: AiUsageTokens): void {
  total.inputTokens += delta.inputTokens
  total.outputTokens += delta.outputTokens
  if (delta.cachedInputTokens) {
    total.cachedInputTokens =
      (total.cachedInputTokens ?? 0) + delta.cachedInputTokens
  }
}

/** Início do ciclo mensal (1º dia do mês corrente, 00:00 UTC). */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/**
 * A cota é checada antes da chamada: bloqueia quando o consumido já
 * alcançou a cota. A chamada em andamento pode ultrapassar um pouco o
 * limite (o custo só é conhecido depois da resposta) — aceitável.
 */
export function isQuotaExceeded(usedUsd: number, quotaUsd: number): boolean {
  return usedUsd >= quotaUsd
}

export function remainingUsd(usedUsd: number, quotaUsd: number): number {
  return Math.max(0, Math.round((quotaUsd - usedUsd) * 100) / 100)
}
