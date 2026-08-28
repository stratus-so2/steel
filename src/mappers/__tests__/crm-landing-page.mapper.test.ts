import { describe, expect, it } from 'vitest'
import {
  createFakeCrmLandingPage,
  createFakeCrmLandingPageSection,
} from '@/src/__tests__/factories/crm-landing-page.factory'
import {
  toCrmLandingPageDTO,
  toCrmLandingPagePublicDTO,
  toCrmLandingPageSectionDTO,
} from '../crm-landing-page.mapper'

describe('toCrmLandingPageSectionDTO()', () => {
  it('should round-trip type/order/enabled/content', () => {
    const section = createFakeCrmLandingPageSection({
      id: 's-1',
      type: 'HERO',
      order: 2,
      enabled: false,
    })
    const dto = toCrmLandingPageSectionDTO(section)
    expect(dto).toEqual({
      id: 's-1',
      type: 'HERO',
      order: 2,
      enabled: false,
      content: section.content,
    })
  })
})

describe('toCrmLandingPageDTO()', () => {
  it('should map all fields correctly', () => {
    const page = createFakeCrmLandingPage({ id: 'p-1', status: 'PUBLISHED' })
    const dto = toCrmLandingPageDTO(page)
    expect(dto.id).toBe('p-1')
    expect(dto.status).toBe('PUBLISHED')
    expect(dto.templateKey).toBe(page.templateKey)
  })

  it('should default viewsCount and sections to empty when absent', () => {
    const page = createFakeCrmLandingPage({ id: 'p-1' })
    const dto = toCrmLandingPageDTO(page)
    expect(dto.viewsCount).toBe(0)
    expect(dto.sections).toEqual([])
  })

  it('should read viewsCount from _count.views when present', () => {
    const page = createFakeCrmLandingPage({ id: 'p-1' })
    const dto = toCrmLandingPageDTO({ ...page, _count: { views: 5 } })
    expect(dto.viewsCount).toBe(5)
  })

  it('should map nested sections when present', () => {
    const page = createFakeCrmLandingPage({ id: 'p-1' })
    const section = createFakeCrmLandingPageSection({ landingPageId: 'p-1' })
    const dto = toCrmLandingPageDTO({ ...page, sections: [section] })
    expect(dto.sections).toHaveLength(1)
    expect(dto.sections[0].id).toBe(section.id)
  })
})

describe('toCrmLandingPagePublicDTO()', () => {
  it('should expose only public fields', () => {
    const page = createFakeCrmLandingPage({
      title: 'Home',
      templateKey: 'agency',
    })
    const section = createFakeCrmLandingPageSection({ landingPageId: page.id })
    const dto = toCrmLandingPagePublicDTO({ ...page, sections: [section] })
    expect(dto.title).toBe('Home')
    expect(dto.templateKey).toBe('agency')
    expect(dto.sections).toHaveLength(1)
  })
})
