import { describe, expect, it } from 'vitest'
import {
  CreateCrmProposalTemplateSchema,
  UpdateCrmProposalTemplateSchema,
} from '../crm-proposal-template.schema'

describe('CreateCrmProposalTemplateSchema', () => {
  it('should require a name', () => {
    expect(CreateCrmProposalTemplateSchema.safeParse({}).success).toBe(false)
  })

  it('should accept a minimal valid payload', () => {
    const result = CreateCrmProposalTemplateSchema.safeParse({
      name: 'Template Padrão',
    })
    expect(result.success).toBe(true)
    expect(result.data?.sections).toEqual([])
  })

  it('should accept a section without defaultContent', () => {
    const result = CreateCrmProposalTemplateSchema.safeParse({
      name: 'Template Padrão',
      sections: [{ type: 'TERMS_CONDITIONS', order: 0, enabled: true }],
    })
    expect(result.success).toBe(true)
  })

  it('should reject a defaultContent type mismatched with the section type', () => {
    const result = CreateCrmProposalTemplateSchema.safeParse({
      name: 'Template Padrão',
      sections: [
        {
          type: 'TERMS_CONDITIONS',
          order: 0,
          enabled: true,
          defaultContent: { type: 'COVER', title: 'X' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmProposalTemplateSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmProposalTemplateSchema.safeParse({}).success).toBe(true)
  })

  it('should accept clearing description with null', () => {
    expect(
      UpdateCrmProposalTemplateSchema.safeParse({ description: null }).success,
    ).toBe(true)
  })
})
