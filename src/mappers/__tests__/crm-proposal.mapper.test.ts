import { describe, expect, it } from 'vitest'
import { createFakeCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import {
  toCrmProposalDTO,
  toCrmProposalPublicDTO,
} from '../crm-proposal.mapper'

describe('toCrmProposalDTO()', () => {
  it('should map all fields correctly', () => {
    const proposal = createFakeCrmProposal({ id: 'p-1', title: 'Proposta' })
    const dto = toCrmProposalDTO(proposal)
    expect(dto.id).toBe('p-1')
    expect(dto.title).toBe('Proposta')
  })
})

describe('toCrmProposalPublicDTO()', () => {
  it('should omit internal fields', () => {
    const proposal = createFakeCrmProposal({ id: 'p-1', shareToken: 'tok' })
    const dto = toCrmProposalPublicDTO(proposal)
    expect(dto).toEqual({
      id: 'p-1',
      title: proposal.title,
      content: proposal.content,
      type: proposal.type,
    })
  })
})
