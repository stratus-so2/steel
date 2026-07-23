import { describe, expect, it } from 'vitest'
import {
  CreateCrmQuotaSchema,
  ListCrmQuotasSchema,
  UpdateCrmQuotaSchema,
} from '../crm-quota.schema'

describe('CreateCrmQuotaSchema', () => {
  it('should default targetAmount to 0', () => {
    const result = CreateCrmQuotaSchema.safeParse({
      ownerId: 'u1',
      period: 'MONTH',
      periodKey: '2026-08',
    })
    expect(result.success).toBe(true)
    expect(result.data?.targetAmount).toBe(0)
  })

  it('should reject an invalid period', () => {
    const result = CreateCrmQuotaSchema.safeParse({
      ownerId: 'u1',
      period: 'YEAR',
      periodKey: '2026',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmQuotaSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmQuotaSchema.safeParse({}).success).toBe(true)
  })
})

describe('ListCrmQuotasSchema', () => {
  it('should accept optional filters', () => {
    expect(
      ListCrmQuotasSchema.safeParse({ ownerId: 'u1', period: 'QUARTER' })
        .success,
    ).toBe(true)
  })
})
