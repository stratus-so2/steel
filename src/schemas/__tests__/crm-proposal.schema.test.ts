import { describe, expect, it } from 'vitest'
import {
  CreateCrmProposalSchema,
  CrmProposalSectionContentSchema,
  RecordCrmProposalViewSchema,
  UpdateCrmProposalSchema,
} from '../crm-proposal.schema'

const coverSection = {
  type: 'COVER' as const,
  order: 0,
  enabled: true,
  content: { type: 'COVER' as const, title: 'Proposta X' },
}

describe('CreateCrmProposalSchema', () => {
  it('should require name and responsibleId', () => {
    expect(CreateCrmProposalSchema.safeParse({}).success).toBe(false)
    expect(
      CreateCrmProposalSchema.safeParse({ name: 'Proposta X' }).success,
    ).toBe(false)
  })

  it('should accept a minimal valid payload with no sections', () => {
    const result = CreateCrmProposalSchema.safeParse({
      name: 'Proposta X',
      responsibleId: 'user-1',
    })
    expect(result.success).toBe(true)
    expect(result.data?.sections).toEqual([])
  })

  it('should accept sections whose content type matches the envelope type', () => {
    const result = CreateCrmProposalSchema.safeParse({
      name: 'Proposta X',
      responsibleId: 'user-1',
      sections: [coverSection],
    })
    expect(result.success).toBe(true)
  })

  it('should reject a section whose content type does not match the envelope type', () => {
    const result = CreateCrmProposalSchema.safeParse({
      name: 'Proposta X',
      responsibleId: 'user-1',
      sections: [{ ...coverSection, type: 'SOLUTION' }],
    })
    expect(result.success).toBe(false)
  })

  it('should reject an unknown section content shape', () => {
    const result = CreateCrmProposalSchema.safeParse({
      name: 'Proposta X',
      responsibleId: 'user-1',
      sections: [
        { type: 'COVER', order: 0, enabled: true, content: { type: 'COVER' } },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmProposalSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmProposalSchema.safeParse({}).success).toBe(true)
  })

  it('should accept a status transition', () => {
    expect(UpdateCrmProposalSchema.safeParse({ status: 'SENT' }).success).toBe(
      true,
    )
  })

  it('should reject an invalid status', () => {
    expect(
      UpdateCrmProposalSchema.safeParse({ status: 'PUBLISHED' }).success,
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

describe('CrmProposalSectionContentSchema — pt-BR messages', () => {
  function messages(content: unknown) {
    const result = CrmProposalSectionContentSchema.safeParse(content)
    return result.success ? [] : result.error.issues.map((i) => i.message)
  }

  it('explains invalid product lines in pt-BR', () => {
    expect(
      messages({
        type: 'PRODUCTS_PRICING',
        items: [{ name: '', quantity: 0, unitPrice: -1, total: 0 }],
        discount: 0,
        total: 0,
      }),
    ).toEqual([
      'Nome do item é obrigatório',
      'Quantidade deve ser maior que zero',
      'Valor unitário não pode ser negativo',
    ])
  })

  it('explains an empty list item title in pt-BR', () => {
    expect(
      messages({ type: 'SCOPE', items: [{ title: '', description: '' }] }),
    ).toEqual(['Título do item é obrigatório'])
  })
})
