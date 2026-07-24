import { describe, expect, it } from 'vitest'
import {
  CreateCrmCompetitorSchema,
  UpdateCrmCompetitorSchema,
} from '../crm-competitor.schema'

describe('CreateCrmCompetitorSchema', () => {
  it('should reject an empty handle', () => {
    expect(
      CreateCrmCompetitorSchema.safeParse({ platform: 'INSTAGRAM', handle: '' })
        .success,
    ).toBe(false)
  })

  it('should accept a valid competitor', () => {
    const result = CreateCrmCompetitorSchema.safeParse({
      platform: 'INSTAGRAM',
      handle: '@concorrente',
      profileUrl: 'https://instagram.com/concorrente',
    })
    expect(result.success).toBe(true)
  })

  it('should reject an invalid profileUrl', () => {
    expect(
      CreateCrmCompetitorSchema.safeParse({
        platform: 'INSTAGRAM',
        handle: '@concorrente',
        profileUrl: 'not-a-url',
      }).success,
    ).toBe(false)
  })

  it('should require a platform', () => {
    expect(
      CreateCrmCompetitorSchema.safeParse({ handle: '@concorrente' }).success,
    ).toBe(false)
  })
})

describe('UpdateCrmCompetitorSchema', () => {
  it('should reject an empty payload', () => {
    expect(UpdateCrmCompetitorSchema.safeParse({}).success).toBe(false)
  })

  it('should accept a partial payload', () => {
    expect(
      UpdateCrmCompetitorSchema.safeParse({ followersCount: 1000 }).success,
    ).toBe(true)
  })
})
