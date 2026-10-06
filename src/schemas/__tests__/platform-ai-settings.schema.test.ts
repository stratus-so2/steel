import { describe, expect, it } from 'vitest'
import { UpdatePlatformAiSettingsSchema } from '../platform-ai-settings.schema'

describe('UpdatePlatformAiSettingsSchema', () => {
  it('should accept a margin within bounds and coerce strings', () => {
    expect(
      UpdatePlatformAiSettingsSchema.parse({
        costMargin: '1.3',
        reason: ' x ',
      }),
    ).toEqual({ costMargin: 1.3, reason: 'x' })
    expect(UpdatePlatformAiSettingsSchema.parse({ costMargin: 1 })).toEqual({
      costMargin: 1,
    })
  })

  it('should reject margins out of bounds and long reasons', () => {
    expect(
      UpdatePlatformAiSettingsSchema.safeParse({ costMargin: 0 }).success,
    ).toBe(false)
    expect(
      UpdatePlatformAiSettingsSchema.safeParse({ costMargin: 101 }).success,
    ).toBe(false)
    expect(
      UpdatePlatformAiSettingsSchema.safeParse({
        costMargin: 1,
        reason: 'x'.repeat(501),
      }).success,
    ).toBe(false)
    expect(UpdatePlatformAiSettingsSchema.safeParse({}).success).toBe(false)
  })
})
