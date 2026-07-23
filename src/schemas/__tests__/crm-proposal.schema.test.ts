import { describe, expect, it } from 'vitest'
import {
  CreateCrmProposalSchema,
  RecordCrmProposalViewSchema,
  UpdateCrmProposalSchema,
} from '../crm-proposal.schema'

describe('CreateCrmProposalSchema', () => {
  it('should default content to empty and type to PROPOSAL', () => {
    const result = CreateCrmProposalSchema.safeParse({ title: 'Proposta X' })
    expect(result.success).toBe(true)
    expect(result.data?.content).toBe('')
    expect(result.data?.type).toBe('PROPOSAL')
  })

  it('should reject when title is missing', () => {
    expect(CreateCrmProposalSchema.safeParse({}).success).toBe(false)
  })
})

describe('UpdateCrmProposalSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmProposalSchema.safeParse({}).success).toBe(true)
  })

  it('should accept a status transition', () => {
    expect(
      UpdateCrmProposalSchema.safeParse({ status: 'PUBLISHED' }).success,
    ).toBe(true)
  })

  it('should reject an invalid status', () => {
    expect(
      UpdateCrmProposalSchema.safeParse({ status: 'ARCHIVED' }).success,
    ).toBe(false)
  })
})

describe('RecordCrmProposalViewSchema', () => {
  it('should apply defaults', () => {
    const result = RecordCrmProposalViewSchema.safeParse({ viewId: 'v1' })
    expect(result.success).toBe(true)
    expect(result.data?.durationMs).toBe(0)
    expect(result.data?.reachedEnd).toBe(false)
  })

  it('should reject scrolledPct above 100', () => {
    expect(
      RecordCrmProposalViewSchema.safeParse({ viewId: 'v1', scrolledPct: 150 })
        .success,
    ).toBe(false)
  })
})
