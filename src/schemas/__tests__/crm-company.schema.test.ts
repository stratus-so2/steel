import { describe, expect, it } from 'vitest'
import {
  CreateCrmCompanySchema,
  ListCrmCompaniesSchema,
  ReorderCrmCompaniesSchema,
  UpdateCrmCompanySchema,
} from '../crm-company.schema'

describe('CreateCrmCompanySchema', () => {
  it('should accept minimal valid input and default icp to false', () => {
    const result = CreateCrmCompanySchema.safeParse({ name: 'Acme' })

    expect(result.success).toBe(true)
    expect(result.data?.icp).toBe(false)
  })

  it('should accept all optional fields', () => {
    const result = CreateCrmCompanySchema.safeParse({
      name: 'Acme',
      cnpj: '12345678000199',
      domain: 'acme.com',
      employees: 50,
      linkedin: 'https://linkedin.com/company/acme',
      address: { city: 'São Paulo', state: 'SP' },
      arr: 120000,
      icp: true,
      accountOwnerId: 'user_123',
    })

    expect(result.success).toBe(true)
  })

  it('should reject when name is missing', () => {
    const result = CreateCrmCompanySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('should reject negative arr', () => {
    const result = CreateCrmCompanySchema.safeParse({
      name: 'Acme',
      arr: -1,
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmCompanySchema', () => {
  it('should accept a partial payload', () => {
    const result = UpdateCrmCompanySchema.safeParse({ name: 'New name' })
    expect(result.success).toBe(true)
  })

  it('should accept an empty payload', () => {
    const result = UpdateCrmCompanySchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('ListCrmCompaniesSchema', () => {
  it('should transform icp query param to boolean', () => {
    const result = ListCrmCompaniesSchema.safeParse({ icp: 'true' })
    expect(result.success).toBe(true)
    expect(result.data?.icp).toBe(true)
  })

  it('should leave icp undefined when omitted', () => {
    const result = ListCrmCompaniesSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.icp).toBeUndefined()
  })
})

describe('ReorderCrmCompaniesSchema', () => {
  it('should reject an empty orderedIds array', () => {
    const result = ReorderCrmCompaniesSchema.safeParse({ orderedIds: [] })
    expect(result.success).toBe(false)
  })

  it('should accept a non-empty orderedIds array', () => {
    const result = ReorderCrmCompaniesSchema.safeParse({
      orderedIds: ['a', 'b'],
    })
    expect(result.success).toBe(true)
  })
})
