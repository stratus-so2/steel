import { describe, expect, it } from 'vitest'
import {
  CreateCrmProductSchema,
  ListCrmProductsSchema,
  ReorderCrmProductsSchema,
  UpdateCrmProductSchema,
} from '../crm-product.schema'

describe('CreateCrmProductSchema', () => {
  it('should apply defaults', () => {
    const result = CreateCrmProductSchema.safeParse({ name: 'Plano Pro' })
    expect(result.success).toBe(true)
    expect(result.data?.unitPrice).toBe(0)
    expect(result.data?.currency).toBe('BRL')
    expect(result.data?.billingType).toBe('ONE_TIME')
    expect(result.data?.active).toBe(true)
  })

  it('should reject a negative unitPrice', () => {
    const result = CreateCrmProductSchema.safeParse({
      name: 'Plano Pro',
      unitPrice: -10,
    })
    expect(result.success).toBe(false)
  })

  it('should reject when name is missing', () => {
    expect(CreateCrmProductSchema.safeParse({}).success).toBe(false)
  })
})

describe('UpdateCrmProductSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmProductSchema.safeParse({}).success).toBe(true)
  })

  it('should leave unitPrice/active undefined when omitted, not reset to defaults', () => {
    const result = UpdateCrmProductSchema.safeParse({ name: 'Plano Pro' })
    expect(result.data?.unitPrice).toBeUndefined()
    expect(result.data?.active).toBeUndefined()
  })
})

describe('ListCrmProductsSchema', () => {
  it('should transform active query param to boolean', () => {
    const result = ListCrmProductsSchema.safeParse({ active: 'false' })
    expect(result.success).toBe(true)
    expect(result.data?.active).toBe(false)
  })
})

describe('ReorderCrmProductsSchema', () => {
  it('should reject an empty orderedIds array', () => {
    expect(ReorderCrmProductsSchema.safeParse({ orderedIds: [] }).success).toBe(
      false,
    )
  })
})
