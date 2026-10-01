import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { sdLineTotal, sdMoney, sdSum } from '../servicedesk/money'

describe('servicedesk money', () => {
  it('multiplies with exact decimals rounding half up to cents', () => {
    expect(sdMoney(sdLineTotal('1.5', '10.33'))).toBe('15.50')
    expect(sdMoney(sdLineTotal(3, new Prisma.Decimal('19.99')))).toBe('59.97')
    expect(sdMoney(sdLineTotal('0.1', '0.2'))).toBe('0.02')
    expect(sdMoney(sdLineTotal('0.05', '0.1'))).toBe('0.01')
  })

  it('sums and formats with two places', () => {
    expect(sdMoney(sdSum([]))).toBe('0.00')
    expect(sdMoney(sdSum(['0.1', 0.2, new Prisma.Decimal('1')]))).toBe('1.30')
    expect(sdMoney(1234.5)).toBe('1234.50')
  })
})
