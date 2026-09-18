import { describe, expect, it } from 'vitest'
import { UpdateWhatsAppSettingsSchema } from '../whatsapp-settings.schema'

describe('UpdateWhatsAppSettingsSchema', () => {
  it('should accept 0 (auto-close off) and a positive number of hours', () => {
    expect(
      UpdateWhatsAppSettingsSchema.safeParse({ autoCloseAfterHours: 0 })
        .success,
    ).toBe(true)
    expect(
      UpdateWhatsAppSettingsSchema.safeParse({ autoCloseAfterHours: 24 })
        .success,
    ).toBe(true)
  })

  it('should reject negative, fractional and too large values', () => {
    for (const autoCloseAfterHours of [-1, 1.5, 721]) {
      expect(
        UpdateWhatsAppSettingsSchema.safeParse({ autoCloseAfterHours }).success,
      ).toBe(false)
    }
  })

  it('should accept an empty patch', () => {
    expect(UpdateWhatsAppSettingsSchema.safeParse({}).success).toBe(true)
  })

  describe('sentiment alert', () => {
    it('should accept a full alert configuration', () => {
      expect(
        UpdateWhatsAppSettingsSchema.safeParse({
          sentimentAlertEnabled: true,
          sentimentAlertThreshold: -0.5,
          sentimentAlertNotifyInApp: true,
          sentimentAlertNotifyEmail: true,
          sentimentAlertRecipientIds: ['u1', 'u2'],
          sentimentAlertAssignToId: null,
          sentimentAlertCooldownHours: 12,
        }).success,
      ).toBe(true)
    })

    it('should keep the threshold between -1 and 0', () => {
      for (const sentimentAlertThreshold of [-1.1, 0.2]) {
        expect(
          UpdateWhatsAppSettingsSchema.safeParse({ sentimentAlertThreshold })
            .success,
        ).toBe(false)
      }
    })

    it('should require a cooldown of 1 to 168 whole hours', () => {
      for (const sentimentAlertCooldownHours of [0, 169, 2.5]) {
        expect(
          UpdateWhatsAppSettingsSchema.safeParse({
            sentimentAlertCooldownHours,
          }).success,
        ).toBe(false)
      }
    })
  })
})
