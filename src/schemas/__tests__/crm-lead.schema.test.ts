import { describe, expect, it } from 'vitest'
import {
  CloseCrmLeadLostSchema,
  CloseCrmLeadWonSchema,
  CreateCrmLeadProposalSchema,
  CreateCrmLeadRoutingRuleSchema,
  CreateCrmLeadSchema,
  CreateCrmLeadScoringRuleSchema,
  RegisterCrmLeadContactAttemptSchema,
  RegisterCrmLeadMeetingSchema,
  RegisterCrmLeadProposalPresentationSchema,
  ReorderCrmLeadsSchema,
  SetCrmLeadInterestProductsSchema,
  UpdateCrmLeadRoutingRuleSchema,
  UpdateCrmLeadSchema,
  UpdateCrmLeadScoringRuleSchema,
  UpsertCrmLeadQualificationSchema,
} from '../crm-lead.schema'

describe('CreateCrmLeadSchema', () => {
  it('should default phones to empty', () => {
    const result = CreateCrmLeadSchema.safeParse({
      name: 'Jane',
      emails: ['jane@x.com'],
      source: 'WhatsApp',
    })
    expect(result.success).toBe(true)
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
  it('should leave emails undefined when omitted', () => {
    const result = UpdateCrmLeadSchema.safeParse({ name: 'Jane' })
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

describe('RegisterCrmLeadContactAttemptSchema', () => {
  it('should default outcome to ATTEMPTED and fill occurredAt', () => {
    const result = RegisterCrmLeadContactAttemptSchema.safeParse({
      contactedWith: 'Maria',
      channel: 'WHATSAPP',
    })
    expect(result.success).toBe(true)
    expect(result.data?.outcome).toBe('ATTEMPTED')
    expect(result.data?.occurredAt).toBeInstanceOf(Date)
  })

  it('should reject an invalid channel', () => {
    expect(
      RegisterCrmLeadContactAttemptSchema.safeParse({
        contactedWith: 'Maria',
        channel: 'CARRIER_PIGEON',
      }).success,
    ).toBe(false)
  })
})

describe('SetCrmLeadInterestProductsSchema', () => {
  it('should reject an empty productIds array', () => {
    expect(
      SetCrmLeadInterestProductsSchema.safeParse({ productIds: [] }).success,
    ).toBe(false)
  })
})

describe('UpsertCrmLeadQualificationSchema', () => {
  it('should require decisionMakerName and decisionMakerRole', () => {
    expect(
      UpsertCrmLeadQualificationSchema.safeParse({
        decisionMakerName: 'Carlos',
      }).success,
    ).toBe(false)
  })

  it('should accept a full valid payload', () => {
    expect(
      UpsertCrmLeadQualificationSchema.safeParse({
        decisionMakerName: 'Carlos',
        decisionMakerRole: 'CTO',
      }).success,
    ).toBe(true)
  })
})

describe('RegisterCrmLeadMeetingSchema', () => {
  it('should require interestDetails and identifiedNeed', () => {
    expect(
      RegisterCrmLeadMeetingSchema.safeParse({
        scheduledAt: new Date().toISOString(),
        format: 'ONLINE',
      }).success,
    ).toBe(false)
  })
})

describe('CreateCrmLeadProposalSchema', () => {
  it('should require a name', () => {
    expect(CreateCrmLeadProposalSchema.safeParse({}).success).toBe(false)
  })
})

describe('RegisterCrmLeadProposalPresentationSchema', () => {
  it('should default interactionsCount to 0', () => {
    const result = RegisterCrmLeadProposalPresentationSchema.safeParse({
      presentedAt: new Date().toISOString(),
      format: 'ONLINE',
      amount: 1500,
      interestLevel: 'HIGH',
    })
    expect(result.success).toBe(true)
    expect(result.data?.interactionsCount).toBe(0)
  })

  it('should reject a negative amount', () => {
    expect(
      RegisterCrmLeadProposalPresentationSchema.safeParse({
        presentedAt: new Date().toISOString(),
        format: 'ONLINE',
        amount: -1,
        interestLevel: 'HIGH',
      }).success,
    ).toBe(false)
  })
})

describe('CloseCrmLeadWonSchema', () => {
  it('should require contractSignedConfirmed to be exactly true', () => {
    expect(
      CloseCrmLeadWonSchema.safeParse({
        contractSignedAt: new Date().toISOString(),
        billingType: 'MONTHLY',
        closedAmount: 1000,
        contractSignedConfirmed: false,
      }).success,
    ).toBe(false)
  })

  it('should accept a full valid payload', () => {
    expect(
      CloseCrmLeadWonSchema.safeParse({
        contractSignedAt: new Date().toISOString(),
        billingType: 'MONTHLY',
        closedAmount: 1000,
        contractSignedConfirmed: true,
      }).success,
    ).toBe(true)
  })
})

describe('CloseCrmLeadLostSchema', () => {
  it('should require a lostReason', () => {
    expect(CloseCrmLeadLostSchema.safeParse({}).success).toBe(false)
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
