import { describe, expect, it } from 'vitest'
import {
  CreateCrmScheduledPostSchema,
  CreateCrmSocialConnectionSchema,
  crmPlatformToSlug,
  parseCrmPlatformSlug,
  RescheduleCrmScheduledPostSchema,
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

  it('should validate a rescheduled date only when it is sent', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(
      UpdateCrmScheduledPostSchema.safeParse({ scheduledFor: future }).success,
    ).toBe(true)
    expect(
      UpdateCrmScheduledPostSchema.safeParse({
        scheduledFor: '2020-01-01T00:00:00Z',
      }).success,
    ).toBe(false)
  })
})

describe('platform slugs', () => {
  it('should convert platforms to lower-case route slugs and back', () => {
    expect(crmPlatformToSlug('FACEBOOK')).toBe('facebook')
    expect(crmPlatformToSlug('GOOGLE_ADS')).toBe('google_ads')
    expect(parseCrmPlatformSlug('instagram')).toBe('INSTAGRAM')
    expect(parseCrmPlatformSlug('google_ads')).toBe('GOOGLE_ADS')
  })

  it('should return null for unknown slugs', () => {
    expect(parseCrmPlatformSlug('myspace')).toBeNull()
  })
})

describe('RescheduleCrmScheduledPostSchema', () => {
  it('should accept a future date', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(
      RescheduleCrmScheduledPostSchema.safeParse({ scheduledFor: future })
        .success,
    ).toBe(true)
  })

  it('should reject a date in the past', () => {
    const result = RescheduleCrmScheduledPostSchema.safeParse({
      scheduledFor: '2020-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'A data do agendamento deve estar no futuro',
    )
  })
})
