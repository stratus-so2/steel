import type { PlatformAiSettings } from '@prisma/client'
import { AI_MODEL_CATALOG, DEFAULT_AI_COST_MARGIN } from '@/src/lib/ai/models'
import type {
  PlatformAiModelPriceDTO,
  PlatformAiSettingsDTO,
} from '@/types/platform-ai-settings'

/** Margin of the saved row, or the default when there is none. */
export function toCostMargin(row: PlatformAiSettings | null): number {
  return row ? row.costMargin.toNumber() : DEFAULT_AI_COST_MARGIN
}

function charged(price: number, margin: number): number {
  return Math.round(price * margin * 10_000) / 10_000
}

/** Catalog prices with the margin applied (US$ per 1M tokens). */
export function toAiModelPriceDTOs(margin: number): PlatformAiModelPriceDTO[] {
  return AI_MODEL_CATALOG.map((m) => ({
    key: m.key,
    provider: m.provider,
    label: m.label,
    inputUsdPer1M: m.pricing.inputUsdPer1M,
    outputUsdPer1M: m.pricing.outputUsdPer1M,
    cachedInputUsdPer1M: m.pricing.cachedInputUsdPer1M,
    chargedInputUsdPer1M: charged(m.pricing.inputUsdPer1M, margin),
    chargedOutputUsdPer1M: charged(m.pricing.outputUsdPer1M, margin),
  }))
}

export function toPlatformAiSettingsDTO(
  row: PlatformAiSettings | null,
): PlatformAiSettingsDTO {
  const margin = toCostMargin(row)
  return {
    costMargin: margin,
    updatedAt: row ? row.updatedAt.toISOString() : null,
    models: toAiModelPriceDTOs(margin),
  }
}
