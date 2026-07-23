import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  createFakeCrmOpportunity,
  createFakeCrmOpportunityLineItem,
} from '@/src/__tests__/factories/crm-opportunity.factory'
import {
  toCrmOpportunityDTO,
  toCrmOpportunityLineItemDTO,
} from '../crm-opportunity.mapper'

describe('toCrmOpportunityDTO()', () => {
  it('should map all fields and convert amount to number', () => {
    const opportunity = createFakeCrmOpportunity({
      id: 'op-1',
      name: 'Negócio X',
      amount: new Prisma.Decimal(5000),
    })

    const dto = toCrmOpportunityDTO(opportunity)

    expect(dto.id).toBe('op-1')
    expect(dto.name).toBe('Negócio X')
    expect(dto.amount).toBe(5000)
  })

  it('should default amount and closeDate to null when absent', () => {
    const opportunity = createFakeCrmOpportunity({
      amount: null,
      closeDate: null,
    })

    const dto = toCrmOpportunityDTO(opportunity)

    expect(dto.amount).toBeNull()
    expect(dto.closeDate).toBeNull()
  })
})

describe('toCrmOpportunityLineItemDTO()', () => {
  it('should convert Decimal fields to number', () => {
    const item = createFakeCrmOpportunityLineItem({
      id: 'li-1',
      quantity: 2,
      unitPrice: new Prisma.Decimal(100),
      discountPct: new Prisma.Decimal(10),
      total: new Prisma.Decimal(180),
    })

    const dto = toCrmOpportunityLineItemDTO(item)

    expect(dto.id).toBe('li-1')
    expect(dto.unitPrice).toBe(100)
    expect(dto.discountPct).toBe(10)
    expect(dto.total).toBe(180)
  })
})
