import { describe, expect, it } from 'vitest'
import {
  CreateCrmLandingPageSchema,
  RecordCrmLandingPageViewSchema,
  UpdateCrmLandingPageSchema,
} from '../crm-landing-page.schema'

const heroSection = {
  type: 'HERO' as const,
  order: 0,
  enabled: true,
  content: { type: 'HERO' as const, title: 'Título' },
}

describe('CreateCrmLandingPageSchema', () => {
  it('should default sections to an empty array', () => {
    const result = CreateCrmLandingPageSchema.safeParse({
      title: 'Home',
      templateKey: 'agency',
    })
    expect(result.success).toBe(true)
    expect(result.data?.sections).toEqual([])
  })

  it('should reject when title is missing', () => {
    expect(
      CreateCrmLandingPageSchema.safeParse({ templateKey: 'agency' }).success,
    ).toBe(false)
  })

  it('should reject when templateKey is missing', () => {
    expect(
      CreateCrmLandingPageSchema.safeParse({ title: 'Home' }).success,
    ).toBe(false)
  })

  it('should accept a valid section list, including a repeated type', () => {
    const result = CreateCrmLandingPageSchema.safeParse({
      title: 'Home',
      templateKey: 'agency',
      sections: [heroSection, { ...heroSection, order: 1 }],
    })
    expect(result.success).toBe(true)
  })

  it('should reject a section whose content.type mismatches its envelope type', () => {
    const result = CreateCrmLandingPageSchema.safeParse({
      title: 'Home',
      templateKey: 'agency',
      sections: [{ ...heroSection, type: 'FOOTER' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmLandingPageSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmLandingPageSchema.safeParse({}).success).toBe(true)
  })

  it('should accept a status transition', () => {
    expect(
      UpdateCrmLandingPageSchema.safeParse({ status: 'PUBLISHED' }).success,
    ).toBe(true)
  })

  it('should reject an invalid status', () => {
    expect(
      UpdateCrmLandingPageSchema.safeParse({ status: 'ARCHIVED' }).success,
    ).toBe(false)
  })

  it('should accept an updated section list', () => {
    expect(
      UpdateCrmLandingPageSchema.safeParse({ sections: [heroSection] }).success,
    ).toBe(true)
  })
})

describe('RecordCrmLandingPageViewSchema', () => {
  it('should apply defaults', () => {
    const result = RecordCrmLandingPageViewSchema.safeParse({ viewId: 'v1' })
    expect(result.success).toBe(true)
    expect(result.data?.durationMs).toBe(0)
    expect(result.data?.ctaClicks).toBe(0)
  })
})
