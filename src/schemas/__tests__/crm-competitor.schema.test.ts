import { describe, expect, it } from 'vitest'
import {
  CreateCrmCompetitorSchema,
  PreviewCrmCompetitorSchema,
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

  it('should reject a platform without discovery support', () => {
    expect(
      CreateCrmCompetitorSchema.safeParse({
        platform: 'FACEBOOK',
        handle: '@concorrente',
      }).success,
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

describe('PreviewCrmCompetitorSchema', () => {
  it('should accept a syncable platform + handle', () => {
    expect(
      PreviewCrmCompetitorSchema.safeParse({
        platform: 'YOUTUBE',
        handle: '@concorrente',
      }).success,
    ).toBe(true)
  })

  it('should reject a non-syncable platform', () => {
    expect(
      PreviewCrmCompetitorSchema.safeParse({
        platform: 'LINKEDIN',
        handle: '@concorrente',
      }).success,
    ).toBe(false)
  })
})
