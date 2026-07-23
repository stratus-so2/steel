import { describe, expect, it } from 'vitest'
import {
  CreateCrmCalendarEventSchema,
  CreateCrmEmailAccountSchema,
  CreateCrmEmailMessageSchema,
  UpdateCrmCalendarEventSchema,
} from '../crm-email-sync.schema'

describe('CreateCrmEmailAccountSchema', () => {
  it('should reject an unknown provider', () => {
    expect(
      CreateCrmEmailAccountSchema.safeParse({
        provider: 'YAHOO',
        email: 'a@b.com',
      }).success,
    ).toBe(false)
  })

  it('should accept a valid payload', () => {
    expect(
      CreateCrmEmailAccountSchema.safeParse({
        provider: 'GMAIL',
        email: 'a@b.com',
      }).success,
    ).toBe(true)
  })
})

describe('CreateCrmEmailMessageSchema', () => {
  it('should default toEmails to an empty array', () => {
    const result = CreateCrmEmailMessageSchema.safeParse({
      direction: 'OUTBOUND',
      fromEmail: 'a@b.com',
      sentAt: new Date().toISOString(),
    })
    expect(result.success).toBe(true)
    expect(result.data?.toEmails).toEqual([])
  })
})

describe('CreateCrmCalendarEventSchema', () => {
  it('should require a title', () => {
    expect(
      CreateCrmCalendarEventSchema.safeParse({
        startsAt: new Date().toISOString(),
        endsAt: new Date().toISOString(),
      }).success,
    ).toBe(false)
  })
})

describe('UpdateCrmCalendarEventSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmCalendarEventSchema.safeParse({}).success).toBe(true)
  })
})
