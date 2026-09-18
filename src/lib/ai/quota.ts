/**
 * Matemática da cota de IA (pura, sem I/O). Regra de custo do produto:
 * custo = (tokens de entrada + tokens de saída) / 1000 × `usdPer1kTokens`
 * (padrão US$ 4,00 por 1000 tokens, independente do provedor/modelo).
 */

/** Arredonda para 6 casas (precisão da coluna `ai_usage.cost_usd`). */
function roundMicros(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function tokensToUsd(
  inputTokens: number,
  outputTokens: number,
  usdPer1kTokens: number,
): number {
  const tokens = Math.max(0, inputTokens) + Math.max(0, outputTokens)
  return roundMicros((tokens / 1000) * usdPer1kTokens)
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
