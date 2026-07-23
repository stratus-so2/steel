import { describe, expect, it } from 'vitest'
import {
  CreateCrmOpportunityLineItemSchema,
  CreateCrmOpportunitySchema,
  ReorderCrmOpportunitiesSchema,
  UpdateCrmOpportunityLineItemSchema,
  UpdateCrmOpportunitySchema,
} from '../crm-opportunity.schema'

describe('CreateCrmOpportunitySchema', () => {
  it('should accept a minimal valid payload', () => {
    const result = CreateCrmOpportunitySchema.safeParse({
      name: 'Negócio X',
      pipelineId: 'pl1',
      stageId: 'stg1',
    })
    expect(result.success).toBe(true)
  })

  it('should reject when pipelineId is missing', () => {
    const result = CreateCrmOpportunitySchema.safeParse({
      name: 'Negócio X',
      stageId: 'stg1',
    })
    expect(result.success).toBe(false)
  })

  it('should coerce closeDate to a Date', () => {
    const result = CreateCrmOpportunitySchema.safeParse({
      name: 'Negócio X',
      pipelineId: 'pl1',
      stageId: 'stg1',
      closeDate: '2026-08-01',
    })
    expect(result.success).toBe(true)
    expect(result.data?.closeDate).toBeInstanceOf(Date)
  })
})

describe('UpdateCrmOpportunitySchema', () => {
  it('should not require pipelineId', () => {
    const result = UpdateCrmOpportunitySchema.safeParse({ stageId: 'stg2' })
    expect(result.success).toBe(true)
  })

  it('should accept an empty payload', () => {
    expect(UpdateCrmOpportunitySchema.safeParse({}).success).toBe(true)
  })
})

describe('ReorderCrmOpportunitiesSchema', () => {
  it('should require stageId and a non-empty orderedIds', () => {
    expect(
      ReorderCrmOpportunitiesSchema.safeParse({
        stageId: 'stg1',
        orderedIds: ['a'],
      }).success,
    ).toBe(true)
    expect(
      ReorderCrmOpportunitiesSchema.safeParse({ orderedIds: ['a'] }).success,
    ).toBe(false)
  })
})

describe('CreateCrmOpportunityLineItemSchema', () => {
  it('should apply defaults', () => {
    const result = CreateCrmOpportunityLineItemSchema.safeParse({
      name: 'Licença Pro',
    })
    expect(result.success).toBe(true)
    expect(result.data?.quantity).toBe(1)
    expect(result.data?.unitPrice).toBe(0)
    expect(result.data?.discountPct).toBe(0)
    expect(result.data?.billingType).toBe('ONE_TIME')
  })

  it('should reject a discountPct above 100', () => {
    const result = CreateCrmOpportunityLineItemSchema.safeParse({
      name: 'Licença Pro',
      discountPct: 150,
    })
    expect(result.success).toBe(false)
  })

  it('should reject a quantity below 1', () => {
    const result = CreateCrmOpportunityLineItemSchema.safeParse({
      name: 'Licença Pro',
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmOpportunityLineItemSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmOpportunityLineItemSchema.safeParse({}).success).toBe(true)
  })

  it('should leave unitPrice undefined when omitted, not reset to 0', () => {
    const result = UpdateCrmOpportunityLineItemSchema.safeParse({
      quantity: 3,
    })
    expect(result.data?.unitPrice).toBeUndefined()
  })
})
