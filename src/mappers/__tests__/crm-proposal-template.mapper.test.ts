import { describe, expect, it } from 'vitest'
import {
  createFakeCrmProposalTemplate,
  createFakeCrmProposalTemplateSection,
} from '@/src/__tests__/factories/crm-proposal-template.factory'
import { toCrmProposalTemplateDTO } from '../crm-proposal-template.mapper'

describe('toCrmProposalTemplateDTO()', () => {
  it('should map all fields correctly', () => {
    const template = createFakeCrmProposalTemplate({
      id: 't-1',
      name: 'Template Padrão',
    })
    const dto = toCrmProposalTemplateDTO(template)
    expect(dto.id).toBe('t-1')
    expect(dto.name).toBe('Template Padrão')
    expect(dto.sections).toEqual([])
  })

  it('should map defaultContent to null when absent', () => {
    const section = createFakeCrmProposalTemplateSection()
    const template = createFakeCrmProposalTemplate({ id: 't-1' })
    const dto = toCrmProposalTemplateDTO({ ...template, sections: [section] })
    expect(dto.sections[0].defaultContent).toBeNull()
  })
})
