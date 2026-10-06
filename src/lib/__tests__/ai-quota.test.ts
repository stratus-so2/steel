import { describe, expect, it } from 'vitest'
import {
  AI_MODEL_CATALOG,
  aiModelPricing,
  FALLBACK_AI_MODEL_PRICING,
  findAiModel,
} from '../ai/models'
import {
  addAiUsage,
  currentPeriodStart,
  isQuotaExceeded,
  priceAiUsage,
  remainingUsd,
} from '../ai/quota'
import type { AiUsageTokens } from '../ai/types'

const MINI = {
  inputUsdPer1M: 0.15,
  outputUsdPer1M: 0.6,
  cachedInputUsdPer1M: 0.075,
}

describe('priceAiUsage()', () => {
  it('should charge input and output at the model price per 1M tokens', () => {
    // 12k in + 500 out on gpt-4o-mini: 0.0018 + 0.0003
    expect(priceAiUsage(MINI, { inputTokens: 12_000, outputTokens: 500 })).toBe(
      0.0021,
    )
  })

  it('should apply the platform margin on top of the provider price', () => {
    expect(
      priceAiUsage(MINI, { inputTokens: 1_000_000, outputTokens: 0 }, 1.3),
    ).toBe(0.195)
  })

  it('should bill cached input at the cached price', () => {
    expect(
      priceAiUsage(MINI, {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 400_000,
      }),
    ).toBe(0.12) // 600k × 0.15 + 400k × 0.075
  })

  it('should bill cached input as regular input without a cached price', () => {
    expect(
      priceAiUsage(
        { inputUsdPer1M: 1, outputUsdPer1M: 5 },
        { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 500_000 },
      ),
    ).toBe(1)
  })

  it('should clamp negative counts, cached above input and negative margins', () => {
    expect(priceAiUsage(MINI, { inputTokens: -10, outputTokens: -1 })).toBe(0)
    expect(
      priceAiUsage(MINI, {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 5_000_000,
      }),
    ).toBe(0.075)
    expect(
      priceAiUsage(MINI, { inputTokens: 1_000_000, outputTokens: 0 }, -2),
    ).toBe(0)
  })

  it('should round to micro-dollars (column precision)', () => {
    expect(priceAiUsage(MINI, { inputTokens: 1, outputTokens: 0 })).toBe(0)
    expect(priceAiUsage(MINI, { inputTokens: 7, outputTokens: 0 })).toBe(
      0.000001,
    )
  })

  it('should make a typical Steel AI turn cost cents, not dollars', () => {
    // Integrator smoke: 23k input tokens per turn priced at US$ 92 before.
    const cost = priceAiUsage(aiModelPricing({ key: 'openai:gpt-4o-mini' }), {
      inputTokens: 23_000,
      outputTokens: 800,
    })
    expect(cost).toBeLessThan(0.01)
  })
})

describe('aiModelPricing()', () => {
  it('should read the catalog price for every catalog model', () => {
    for (const model of AI_MODEL_CATALOG) {
      expect(aiModelPricing({ key: model.key })).toBe(model.pricing)
      expect(model.pricing.inputUsdPer1M).toBeGreaterThan(0)
      expect(model.pricing.outputUsdPer1M).toBeGreaterThan(
        model.pricing.inputUsdPer1M,
      )
    }
    expect(findAiModel('anthropic:claude-opus-5')?.pricing).toEqual({
      inputUsdPer1M: 5,
      outputUsdPer1M: 25,
      cachedInputUsdPer1M: 0.5,
    })
  })

  it('should use the definition price for a model outside the catalog', () => {
    const own = { inputUsdPer1M: 9, outputUsdPer1M: 9 }
    expect(aiModelPricing({ key: 'openai:custom', pricing: own })).toBe(own)
  })

  it('should fall back to the most expensive catalog price for unknown models', () => {
    expect(aiModelPricing({ key: 'openai:retired' })).toBe(
      FALLBACK_AI_MODEL_PRICING,
    )
    const max = Math.max(
      ...AI_MODEL_CATALOG.map(
        (m) => m.pricing.inputUsdPer1M + m.pricing.outputUsdPer1M,
      ),
    )
    expect(
      FALLBACK_AI_MODEL_PRICING.inputUsdPer1M +
        FALLBACK_AI_MODEL_PRICING.outputUsdPer1M,
    ).toBe(max)
  })
})

describe('addAiUsage()', () => {
  it('should sum input, output and cached tokens in place', () => {
    const total: AiUsageTokens = { inputTokens: 1, outputTokens: 2 }
    addAiUsage(total, { inputTokens: 10, outputTokens: 20 })
    expect(total).toEqual({ inputTokens: 11, outputTokens: 22 })
    addAiUsage(total, { inputTokens: 5, outputTokens: 0, cachedInputTokens: 3 })
    addAiUsage(total, { inputTokens: 5, outputTokens: 0, cachedInputTokens: 2 })
    expect(total).toEqual({
      inputTokens: 21,
      outputTokens: 22,
      cachedInputTokens: 5,
    })
  })
})

describe('currentPeriodStart()', () => {
  it('should return the first day of the month in UTC', () => {
    expect(
      currentPeriodStart(new Date('2026-09-18T15:30:00Z')).toISOString(),
    ).toBe('2026-09-01T00:00:00.000Z')
  })

  it('should use the UTC month at the turn of the month', () => {
    expect(
      currentPeriodStart(new Date('2026-10-01T00:30:00Z')).toISOString(),
    ).toBe('2026-10-01T00:00:00.000Z')
  })
})

describe('isQuotaExceeded()', () => {
  it('should allow usage below the quota', () => {
    expect(isQuotaExceeded(49.99, 50)).toBe(false)
  })

  it('should block once usage reaches the quota', () => {
    expect(isQuotaExceeded(50, 50)).toBe(true)
    expect(isQuotaExceeded(51, 50)).toBe(true)
  })

  it('should block everything with a zero quota', () => {
    expect(isQuotaExceeded(0, 0)).toBe(true)
  })
})

describe('remainingUsd()', () => {
  it('should floor at zero', () => {
    expect(remainingUsd(60, 50)).toBe(0)
    expect(remainingUsd(12.345, 50)).toBe(37.66)
  })
})
