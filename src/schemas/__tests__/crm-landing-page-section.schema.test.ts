import { describe, expect, it } from 'vitest'
import { CrmLandingPageSectionInputSchema } from '../crm-landing-page-section.schema'

describe('CrmLandingPageSectionInputSchema', () => {
  it('should accept a valid HERO section', () => {
    const result = CrmLandingPageSectionInputSchema.safeParse({
      type: 'HERO',
      order: 0,
      enabled: true,
      content: { type: 'HERO', title: 'Título' },
    })
    expect(result.success).toBe(true)
  })

  it('should reject when content.type does not match the envelope type', () => {
    const result = CrmLandingPageSectionInputSchema.safeParse({
      type: 'HERO',
      order: 0,
      enabled: true,
      content: { type: 'FOOTER', links: [] },
    })
    expect(result.success).toBe(false)
  })

  it('should reject a discriminated union mismatch inside content itself', () => {
    const result = CrmLandingPageSectionInputSchema.safeParse({
      type: 'FACTS',
      order: 0,
      enabled: true,
      content: { type: 'FACTS', items: [{ value: '', label: 'x' }] },
    })
    expect(result.success).toBe(false)
  })

  it('should default enabled to true', () => {
    const result = CrmLandingPageSectionInputSchema.safeParse({
      type: 'FOOTER',
      order: 0,
      content: { type: 'FOOTER', links: [] },
    })
    expect(result.success).toBe(true)
    expect(result.data?.enabled).toBe(true)
  })

  it('should require the HERO title', () => {
    const result = CrmLandingPageSectionInputSchema.safeParse({
      type: 'HERO',
      order: 0,
      content: { type: 'HERO', title: '' },
    })
    expect(result.success).toBe(false)
  })
})
