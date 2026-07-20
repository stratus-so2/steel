import { describe, expect, it } from 'vitest'
import { createFakeWhatsAppAiConfig } from '@/src/__tests__/factories/whatsapp-ai-config.factory'
import { toWhatsAppAiConfigDTO } from '../whatsapp-ai-config.mapper'

describe('toWhatsAppAiConfigDTO()', () => {
  it('should never leak the encrypted key, only whether one is set', () => {
    const config = createFakeWhatsAppAiConfig({
      encryptedOpenaiApiKey: 'enc:sk-secret',
    })

    const dto = toWhatsAppAiConfigDTO(config)

    expect(dto).not.toHaveProperty('encryptedOpenaiApiKey')
    expect(dto).not.toHaveProperty('openaiApiKey')
    expect(dto.hasApiKey).toBe(true)
  })

  it('should map model, systemPrompt and active', () => {
    const config = createFakeWhatsAppAiConfig({
      model: 'gpt-4o',
      systemPrompt: 'Seja breve',
      active: true,
    })

    const dto = toWhatsAppAiConfigDTO(config)

    expect(dto.model).toBe('gpt-4o')
    expect(dto.systemPrompt).toBe('Seja breve')
    expect(dto.active).toBe(true)
  })
})
