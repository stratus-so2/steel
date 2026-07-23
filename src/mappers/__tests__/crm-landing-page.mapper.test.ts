import { describe, expect, it } from 'vitest'
import { createFakeCrmLandingPage } from '@/src/__tests__/factories/crm-landing-page.factory'
import {
  toCrmLandingPageDTO,
  toCrmLandingPagePublicDTO,
} from '../crm-landing-page.mapper'

describe('toCrmLandingPageDTO()', () => {
  it('should map all fields correctly', () => {
    const page = createFakeCrmLandingPage({ id: 'p-1', status: 'PUBLISHED' })
    const dto = toCrmLandingPageDTO(page)
    expect(dto.id).toBe('p-1')
    expect(dto.status).toBe('PUBLISHED')
  })

  it('should default viewsCount to 0 when _count is absent', () => {
    const page = createFakeCrmLandingPage({ id: 'p-1' })
    expect(toCrmLandingPageDTO(page).viewsCount).toBe(0)
  })

  it('should read viewsCount from _count.views when present', () => {
    const page = createFakeCrmLandingPage({ id: 'p-1' })
    const dto = toCrmLandingPageDTO({ ...page, _count: { views: 5 } })
    expect(dto.viewsCount).toBe(5)
  })
})

describe('toCrmLandingPagePublicDTO()', () => {
  it('should expose only public fields', () => {
    const page = createFakeCrmLandingPage({ title: 'Home', html: '<p>Oi</p>' })
    const dto = toCrmLandingPagePublicDTO(page)
    expect(dto).toEqual({ title: 'Home', html: '<p>Oi</p>' })
  })
})
