import { describe, expect, it } from 'vitest'
import {
  CreateCrmIntegrationKeySchema,
  IngestCrmLeadSchema,
} from '../crm-integration-key.schema'

describe('CreateCrmIntegrationKeySchema', () => {
  it('should reject when name is missing', () => {
    expect(CreateCrmIntegrationKeySchema.safeParse({}).success).toBe(false)
  })

  it('should accept a valid name', () => {
    expect(
      CreateCrmIntegrationKeySchema.safeParse({ name: 'Zapier' }).success,
    ).toBe(true)
  })
})

describe('IngestCrmLeadSchema', () => {
  it('should default arrays to empty', () => {
    const result = IngestCrmLeadSchema.safeParse({ name: 'Jane' })
    expect(result.success).toBe(true)
    expect(result.data?.emails).toEqual([])
  })

  it('should reject when name is missing', () => {
    expect(IngestCrmLeadSchema.safeParse({}).success).toBe(false)
  })

  it('should accept the same optional profile fields as manual creation', () => {
    const result = IngestCrmLeadSchema.safeParse({
      name: 'Jane',
      emails: ['jane@acme.com'],
      jobTitle: 'CTO',
      city: 'Recife',
      linkedin: 'https://linkedin.com/in/jane',
      channel: 'webhook',
    })
    expect(result.success).toBe(true)
    expect(result.data?.jobTitle).toBe('CTO')
  })
})
