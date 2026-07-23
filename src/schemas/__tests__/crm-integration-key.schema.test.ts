import { describe, expect, it } from 'vitest'
import { CreateCrmIntegrationKeySchema } from '../crm-integration-key.schema'

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
