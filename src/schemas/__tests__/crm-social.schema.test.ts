import { describe, expect, it } from 'vitest'
import {
  CreateCrmScheduledPostSchema,
  CreateCrmSocialConnectionSchema,
  UpdateCrmScheduledPostSchema,
} from '../crm-social.schema'

describe('CreateCrmSocialConnectionSchema', () => {
  it('should reject an unknown platform', () => {
    expect(
      CreateCrmSocialConnectionSchema.safeParse({
        platform: 'MYSPACE',
        externalAccountId: 'acc-1',
      }).success,
    ).toBe(false)
  })

  it('should accept a valid payload', () => {
    expect(
      CreateCrmSocialConnectionSchema.safeParse({
        platform: 'INSTAGRAM',
        externalAccountId: 'acc-1',
        accountName: '@acme',
      }).success,
    ).toBe(true)
  })
})

describe('CreateCrmScheduledPostSchema', () => {
  it('should require at least one platform', () => {
    expect(
      CreateCrmScheduledPostSchema.safeParse({
        content: 'Olá',
        platforms: [],
      }).success,
    ).toBe(false)
  })

  it('should default content to empty string', () => {
    const result = CreateCrmScheduledPostSchema.safeParse({
      platforms: ['FACEBOOK'],
      mode: 'now',
    })
    expect(result.success).toBe(true)
    expect(result.data?.content).toBe('')
  })

  it('should require scheduledFor when mode is "schedule"', () => {
    expect(
      CreateCrmScheduledPostSchema.safeParse({
        platforms: ['FACEBOOK'],
        mode: 'schedule',
      }).success,
    ).toBe(false)
  })

  it('should accept a future scheduledFor when mode is "schedule"', () => {
    expect(
      CreateCrmScheduledPostSchema.safeParse({
        platforms: ['FACEBOOK'],
        mode: 'schedule',
        scheduledFor: new Date(Date.now() + 60_000).toISOString(),
      }).success,
    ).toBe(true)
  })
})

describe('UpdateCrmScheduledPostSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmScheduledPostSchema.safeParse({}).success).toBe(true)
  })
})
