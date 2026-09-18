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
})
