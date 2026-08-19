import { describe, expect, it } from 'vitest'
import {
  createFakeCrmProposal,
  createFakeCrmProposalSection,
} from '@/src/__tests__/factories/crm-proposal.factory'
import {
  toCrmProposalDTO,
  toCrmProposalPublicDTO,
  toCrmProposalSectionDTO,
} from '../crm-proposal.mapper'

describe('toCrmProposalSectionDTO()', () => {
  it('should map a JSON content column back to a typed section content', () => {
    const section = createFakeCrmProposalSection({ id: 's-1' })
    const dto = toCrmProposalSectionDTO(section)
    expect(dto.id).toBe('s-1')
    expect(dto.type).toBe('COVER')
    expect(dto.content).toEqual({ type: 'COVER', title: 'Proposta Comercial' })
  })
})

describe('toCrmProposalDTO()', () => {
  it('should map all fields correctly', () => {
    const proposal = createFakeCrmProposal({ id: 'p-1', name: 'Proposta' })
    const dto = toCrmProposalDTO(proposal)
    expect(dto.id).toBe('p-1')
    expect(dto.name).toBe('Proposta')
    expect(dto.sections).toEqual([])
  })

  it('should default viewsCount to 0 when _count is absent', () => {
    const proposal = createFakeCrmProposal({ id: 'p-1' })
    expect(toCrmProposalDTO(proposal).viewsCount).toBe(0)
  })

  it('should read viewsCount from _count.views when present', () => {
    const proposal = createFakeCrmProposal({ id: 'p-1' })
    const dto = toCrmProposalDTO({ ...proposal, _count: { views: 7 } })
    expect(dto.viewsCount).toBe(7)
  })

  it('should map nested sections when present', () => {
    const section = createFakeCrmProposalSection()
    const proposal = createFakeCrmProposal({ id: 'p-1' })
    const dto = toCrmProposalDTO({ ...proposal, sections: [section] })
    expect(dto.sections).toHaveLength(1)
    expect(dto.sections[0].type).toBe('COVER')
  })
})

describe('toCrmProposalPublicDTO()', () => {
  it('should omit internal fields and only expose enabled sections', () => {
    const enabled = createFakeCrmProposalSection({ enabled: true })
    const disabled = createFakeCrmProposalSection({
      enabled: false,
      type: 'TERMS_CONDITIONS',
      content: { type: 'TERMS_CONDITIONS', text: 'x' } as never,
    })
    const proposal = createFakeCrmProposal({ id: 'p-1', shareToken: 'tok' })
    const dto = toCrmProposalPublicDTO({
      ...proposal,
      sections: [enabled, disabled],
    })
    expect(dto).toEqual({
      id: 'p-1',
      name: proposal.name,
      status: proposal.status,
      validUntil: null,
      sections: [
        {
          id: enabled.id,
          type: enabled.type,
          order: enabled.order,
          enabled: true,
          content: { type: 'COVER', title: 'Proposta Comercial' },
        },
      ],
    })
  })
})
