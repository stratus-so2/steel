import { describe, expect, it } from 'vitest'
import {
  CONFIGURABLE_NOTIFICATION_KINDS,
  UpdateNotificationDeliverySchema,
  UpdateNotificationPreferencesSchema,
} from '../notification-preference.schema'

describe('UpdateNotificationPreferencesSchema', () => {
  it('should accept configurable kinds', () => {
    const parsed = UpdateNotificationPreferencesSchema.safeParse({
      preferences: [
        { kind: 'CRM_LEAD_ASSIGNED', inApp: false },
        { kind: 'WHATSAPP_NEGATIVE_SENTIMENT', inApp: true },
        { kind: 'AI_QUOTA_WARNING', inApp: false },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('should reject ServiceDesk and unknown kinds with a pt-BR message', () => {
    const sd = UpdateNotificationPreferencesSchema.safeParse({
      preferences: [{ kind: 'SD_TICKET_ASSIGNED', inApp: false }],
    })
    expect(sd.success).toBe(false)
    expect(sd.error?.issues[0].message).toBe('Tipo de notificação inválido')

    expect(
      UpdateNotificationPreferencesSchema.safeParse({
        preferences: [{ kind: 'NOPE', inApp: false }],
      }).success,
    ).toBe(false)
  })

  it('should require between 1 and 100 items and a boolean flag', () => {
    expect(
      UpdateNotificationPreferencesSchema.safeParse({ preferences: [] })
        .success,
    ).toBe(false)
    expect(
      UpdateNotificationPreferencesSchema.safeParse({
        preferences: Array.from({ length: 101 }, () => ({
          kind: 'CRM_TASK_DUE',
          inApp: true,
        })),
      }).success,
    ).toBe(false)
    expect(
      UpdateNotificationPreferencesSchema.safeParse({
        preferences: [{ kind: 'CRM_TASK_DUE', inApp: 'no' }],
      }).success,
    ).toBe(false)
  })

  it('should derive the configurable list from the catalog', () => {
    expect(CONFIGURABLE_NOTIFICATION_KINDS).toContain('MEMBER_JOINED')
    expect(
      CONFIGURABLE_NOTIFICATION_KINDS.some((kind) => kind.startsWith('SD_')),
    ).toBe(false)
  })
})

describe('UpdateNotificationDeliverySchema', () => {
  it('should accept the browser switch', () => {
    expect(
      UpdateNotificationDeliverySchema.parse({ browserEnabled: true }),
    ).toEqual({ browserEnabled: true })
  })

  it('should reject a missing or non-boolean switch', () => {
    expect(UpdateNotificationDeliverySchema.safeParse({}).success).toBe(false)
    expect(
      UpdateNotificationDeliverySchema.safeParse({ browserEnabled: 'true' })
        .success,
    ).toBe(false)
  })
})

describe('CONFIGURABLE_NOTIFICATION_KINDS (Steel AI)', () => {
  it('should let the user mute the AI expiry notice', () => {
    expect(CONFIGURABLE_NOTIFICATION_KINDS).toContain('AI_ACTION_EXPIRING')
  })
})
