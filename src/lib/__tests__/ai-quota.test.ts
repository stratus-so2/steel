import { describe, expect, it } from 'vitest'
import { DEFAULT_USD_PER_1K_TOKENS } from '../ai/models'
import {
  currentPeriodStart,
  isQuotaExceeded,
  remainingUsd,
  tokensToUsd,
} from '../ai/quota'

describe('tokensToUsd()', () => {
  it('should apply the default rule: 1000 tokens = US$ 4.00', () => {
    expect(tokensToUsd(600, 400, DEFAULT_USD_PER_1K_TOKENS)).toBe(4)
  })

  it('should charge fractions of 1000 tokens proportionally', () => {
    expect(tokensToUsd(1, 0, DEFAULT_USD_PER_1K_TOKENS)).toBe(0.004)
    expect(tokensToUsd(250, 0, DEFAULT_USD_PER_1K_TOKENS)).toBe(1)
  })

  it('should honor a custom rate', () => {
    expect(tokensToUsd(2000, 0, 1.5)).toBe(3)
  })

  it('should never produce a negative cost', () => {
    expect(tokensToUsd(-10, 0, DEFAULT_USD_PER_1K_TOKENS)).toBe(0)
  })

  it('should put the default US$ 50 quota at 12.500 tokens', () => {
    expect(tokensToUsd(12_500, 0, DEFAULT_USD_PER_1K_TOKENS)).toBe(50)
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
