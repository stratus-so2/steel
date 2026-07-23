import { describe, expect, it } from 'vitest'
import {
  CreateCrmLandingPageSchema,
  RecordCrmLandingPageViewSchema,
  UpdateCrmLandingPageSchema,
} from '../crm-landing-page.schema'

describe('CreateCrmLandingPageSchema', () => {
  it('should default html to empty string', () => {
    const result = CreateCrmLandingPageSchema.safeParse({ title: 'Home' })
    expect(result.success).toBe(true)
    expect(result.data?.html).toBe('')
  })

  it('should reject when title is missing', () => {
    expect(CreateCrmLandingPageSchema.safeParse({}).success).toBe(false)
  })
})

describe('UpdateCrmLandingPageSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmLandingPageSchema.safeParse({}).success).toBe(true)
  })

  it('should leave omitted fields undefined', () => {
    const result = UpdateCrmLandingPageSchema.safeParse({ title: 'Novo' })
    expect(result.data?.html).toBeUndefined()
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
