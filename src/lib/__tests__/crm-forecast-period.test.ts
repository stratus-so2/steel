import { describe, expect, it } from 'vitest'
import { monthKey, periodKeyOf, quarterKey } from '../crm-forecast-period'

describe('crm-forecast-period', () => {
  it('monthKey formata AAAA-MM em UTC', () => {
    expect(monthKey(new Date('2026-06-15T12:00:00.000Z'))).toBe('2026-06')
    expect(monthKey(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01')
    expect(monthKey(new Date('2026-12-31T23:59:59.000Z'))).toBe('2026-12')
  })

  it('quarterKey mapeia o mês para o trimestre correto', () => {
    expect(quarterKey(new Date('2026-01-10T00:00:00.000Z'))).toBe('2026-Q1')
    expect(quarterKey(new Date('2026-04-10T00:00:00.000Z'))).toBe('2026-Q2')
    expect(quarterKey(new Date('2026-07-10T00:00:00.000Z'))).toBe('2026-Q3')
    expect(quarterKey(new Date('2026-12-10T00:00:00.000Z'))).toBe('2026-Q4')
  })

  it('periodKeyOf respeita a granularidade', () => {
    const date = new Date('2026-05-20T00:00:00.000Z')
    expect(periodKeyOf(date, 'MONTH')).toBe('2026-05')
    expect(periodKeyOf(date, 'QUARTER')).toBe('2026-Q2')
  })
})
