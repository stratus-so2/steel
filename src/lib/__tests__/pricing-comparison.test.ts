import { describe, expect, it } from 'vitest'
import { PAID_PLAN_PRICES } from '@/src/config/plan-prices'
import {
  formatListPrice,
  formatMoney,
  steelComparisonPlans,
  teamMonthlyCost,
} from '@/src/lib/pricing/comparison'

describe('formatMoney', () => {
  it('keeps the original currency and hides whole cents', () => {
    expect(formatMoney(5500, 'USD')).toBe('US$ 55')
    expect(formatMoney(6570, 'BRL')).toBe('R$ 65,70')
    expect(formatMoney(249900, 'BRL')).toBe('R$ 2.499')
  })
})

describe('formatListPrice', () => {
  it.each([
    [{ kind: 'per-seat', cents: 1900 } as const, 'US$ 19 por usuário/mês'],
    [
      { kind: 'per-seat-range', minCents: 9000, maxCents: 10000 } as const,
      'US$ 90 a US$ 100 por usuário/mês',
    ],
    [{ kind: 'flat', cents: 60000 } as const, 'US$ 600 por mês'],
    [{ kind: 'quote' } as const, 'Sob consulta'],
  ])('%o', (price, text) => {
    expect(formatListPrice(price, 'USD')).toBe(text)
  })
})

describe('teamMonthlyCost', () => {
  it('multiplies per-seat prices by the team size', () => {
    expect(teamMonthlyCost({ kind: 'per-seat', cents: 2000 }, 'USD')).toBe(
      'US$ 200',
    )
    expect(teamMonthlyCost({ kind: 'per-seat', cents: 1000 }, 'BRL', 3)).toBe(
      'R$ 30',
    )
    expect(
      teamMonthlyCost(
        { kind: 'per-seat-range', minCents: 700, maxCents: 2000 },
        'USD',
      ),
    ).toBe('US$ 70 a US$ 200')
  })

  it('cannot compute account-wide or on-request prices', () => {
    expect(teamMonthlyCost({ kind: 'flat', cents: 60000 }, 'BRL')).toBeNull()
    expect(teamMonthlyCost({ kind: 'quote' }, 'BRL')).toBeNull()
  })
})

describe('steelComparisonPlans', () => {
  it('reads Steel prices from plan-prices on annual billing', () => {
    const plans = steelComparisonPlans()
    expect(plans.map((p) => p.name)).toEqual([
      'Free',
      'Pro',
      'Business',
      'Enterprise',
    ])
    expect(plans[0]).toEqual({
      name: 'Free',
      price: { kind: 'per-seat', cents: 0 },
      note: 'até 12 usuários',
    })
    expect(plans[1]).toEqual({
      name: 'Pro',
      price: {
        kind: 'per-seat',
        cents: Math.round(PAID_PLAN_PRICES.PRO.yearly / 12),
      },
    })
    expect(plans[2].note).toBe('até 12 usuários')
    expect(plans[3]).toEqual({ name: 'Enterprise', price: { kind: 'quote' } })
  })
})
