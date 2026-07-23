import { describe, expect, it } from 'vitest'
import {
  CreateCrmPersonSchema,
  ListCrmPeopleSchema,
  ReorderCrmPeopleSchema,
  UpdateCrmPersonSchema,
} from '../crm-person.schema'

describe('CreateCrmPersonSchema', () => {
  it('should accept minimal valid input and default arrays to empty', () => {
    const result = CreateCrmPersonSchema.safeParse({ name: 'Jane Doe' })

    expect(result.success).toBe(true)
    expect(result.data?.emails).toEqual([])
    expect(result.data?.phones).toEqual([])
  })

  it('should accept all optional fields', () => {
    const result = CreateCrmPersonSchema.safeParse({
      name: 'Jane Doe',
      emails: ['jane@acme.com'],
      phones: ['+5511999999999'],
      city: 'São Paulo',
      jobTitle: 'CTO',
      linkedin: 'https://linkedin.com/in/jane',
      avatar: 'https://cdn.example.com/jane.png',
      companyId: 'company_123',
    })

    expect(result.success).toBe(true)
  })

  it('should reject when name is missing', () => {
    const result = CreateCrmPersonSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('should reject an invalid email', () => {
    const result = CreateCrmPersonSchema.safeParse({
      name: 'Jane Doe',
      emails: ['not-an-email'],
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmPersonSchema', () => {
  it('should accept an empty payload', () => {
    const result = UpdateCrmPersonSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('ListCrmPeopleSchema', () => {
  it('should accept an optional companyId filter', () => {
    const result = ListCrmPeopleSchema.safeParse({ companyId: 'company_1' })
    expect(result.success).toBe(true)
  })
})

describe('ReorderCrmPeopleSchema', () => {
  it('should reject an empty orderedIds array', () => {
    const result = ReorderCrmPeopleSchema.safeParse({ orderedIds: [] })
    expect(result.success).toBe(false)
  })
})
