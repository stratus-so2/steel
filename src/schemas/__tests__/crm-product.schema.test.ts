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

describe('UpdateCrmProductSchema — clearing optional fields', () => {
  it.each(['sku', 'description'])('should accept null to clear %s', (field) => {
    const result = UpdateCrmProductSchema.safeParse({ [field]: null })
    expect(result.success).toBe(true)
    expect((result.data as Record<string, unknown>)[field]).toBeNull()
  })

  it.each([
    'sku',
    'description',
  ])('should normalize an emptied %s to null', (field) => {
    const result = UpdateCrmProductSchema.safeParse({ [field]: '  ' })
    expect(result.success).toBe(true)
    expect((result.data as Record<string, unknown>)[field]).toBeNull()
  })

  it('should leave omitted optional fields undefined', () => {
    const result = UpdateCrmProductSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('sku')
  })
})

describe('ListCrmProductsSchema — no filter', () => {
  it('should leave active undefined when the query param is absent', () => {
    const result = ListCrmProductsSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.active).toBeUndefined()
  })

  it('should treat any value other than "true" as false', () => {
    expect(ListCrmProductsSchema.parse({ active: 'true' }).active).toBe(true)
    expect(ListCrmProductsSchema.parse({ active: 'yes' }).active).toBe(false)
  })
})
