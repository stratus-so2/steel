import { describe, expect, it } from 'vitest'
import { SaveWhatsAppAiConfigSchema } from '../whatsapp-ai-config.schema'

describe('SaveWhatsAppAiConfigSchema', () => {
  it('should accept an empty object (all fields optional)', () => {
    expect(SaveWhatsAppAiConfigSchema.safeParse({}).success).toBe(true)
  })

  it('should accept a full payload', () => {
    const result = SaveWhatsAppAiConfigSchema.safeParse({
      openaiApiKey: 'sk-test',
      model: 'gpt-4o-mini',
      systemPrompt: 'Seja educado',
      active: true,
    })
    expect(result.success).toBe(true)
  })

  it('should reject an empty openaiApiKey when the key is present', () => {
    expect(
      SaveWhatsAppAiConfigSchema.safeParse({ openaiApiKey: '' }).success,
    ).toBe(false)
  })
})
