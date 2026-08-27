import { describe, expect, it } from 'vitest'
import {
  CreateCrmLeadRoutingRuleSchema,
  CreateCrmLeadSchema,
  CreateCrmLeadScoringRuleSchema,
  ReorderCrmLeadsSchema,
  UpdateCrmLeadRoutingRuleSchema,
  UpdateCrmLeadSchema,
  UpdateCrmLeadScoringRuleSchema,
} from '../crm-lead.schema'

describe('CreateCrmLeadSchema', () => {
  it('should default status to NEW and phones to empty', () => {
    const result = CreateCrmLeadSchema.safeParse({
      name: 'Jane',
      emails: ['jane@x.com'],
      source: 'WhatsApp',
    })
    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('NEW')
    expect(result.data?.phones).toEqual([])
  })

  it('should reject when name is missing', () => {
    expect(CreateCrmLeadSchema.safeParse({}).success).toBe(false)
  })

  it('should reject when source is missing', () => {
    const result = CreateCrmLeadSchema.safeParse({
      name: 'Jane',
      emails: ['jane@x.com'],
    })
    expect(result.success).toBe(false)
  })

  it('should reject when neither email nor phone is provided', () => {
    const result = CreateCrmLeadSchema.safeParse({
      name: 'Jane',
      source: 'WhatsApp',
    })
    expect(result.success).toBe(false)
  })

  it('should accept phone-only with no email', () => {
    const result = CreateCrmLeadSchema.safeParse({
      name: 'Jane',
      phones: ['+5511999999999'],
      source: 'WhatsApp',
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateCrmLeadSchema', () => {
  it('should leave status and emails undefined when omitted', () => {
    const result = UpdateCrmLeadSchema.safeParse({ name: 'Jane' })
    expect(result.data?.status).toBeUndefined()
    expect(result.data?.emails).toBeUndefined()
  })
})

describe('ReorderCrmLeadsSchema', () => {
  it('should reject an empty orderedIds array', () => {
    expect(ReorderCrmLeadsSchema.safeParse({ orderedIds: [] }).success).toBe(
      false,
    )
  })
})

describe('CreateCrmLeadScoringRuleSchema', () => {
  it('should apply defaults', () => {
    const result = CreateCrmLeadScoringRuleSchema.safeParse({
      field: 'email',
      operator: 'is_not_empty',
    })
    expect(result.success).toBe(true)
    expect(result.data?.points).toBe(0)
    expect(result.data?.active).toBe(true)
  })

  it('should reject an invalid field', () => {
    const result = CreateCrmLeadScoringRuleSchema.safeParse({
      field: 'invalid',
      operator: 'equals',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmLeadScoringRuleSchema', () => {
  it('should leave active undefined when omitted', () => {
    const result = UpdateCrmLeadScoringRuleSchema.safeParse({ points: 10 })
    expect(result.data?.active).toBeUndefined()
  })
})

describe('CreateCrmLeadRoutingRuleSchema', () => {
  it('should require an ownerId', () => {
    expect(
      CreateCrmLeadRoutingRuleSchema.safeParse({
        field: 'source',
        operator: 'equals',
        value: 'ads',
      }).success,
    ).toBe(false)
  })

  it('should accept a full valid payload', () => {
    expect(
      CreateCrmLeadRoutingRuleSchema.safeParse({
        field: 'source',
        operator: 'equals',
        value: 'ads',
        ownerId: 'u1',
      }).success,
    ).toBe(true)
  })
})

describe('UpdateCrmLeadRoutingRuleSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmLeadRoutingRuleSchema.safeParse({}).success).toBe(true)
  })
})
