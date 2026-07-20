import { describe, expect, it } from 'vitest'
import {
  CreateWhatsAppQuickReplySchema,
  UpdateWhatsAppQuickReplySchema,
} from '../whatsapp-quick-reply.schema'

const valid = {
  shortcut: 'saudacao',
  title: 'Saudação',
  body: 'Olá! Como posso ajudar?',
}

describe('CreateWhatsAppQuickReplySchema', () => {
  it('should accept a valid quick reply', () => {
    expect(CreateWhatsAppQuickReplySchema.safeParse(valid).success).toBe(true)
  })

  it('should reject a missing shortcut', () => {
    const { shortcut: _shortcut, ...rest } = valid
    expect(CreateWhatsAppQuickReplySchema.safeParse(rest).success).toBe(false)
  })

  it('should reject an empty body', () => {
    expect(
      CreateWhatsAppQuickReplySchema.safeParse({ ...valid, body: '' }).success,
    ).toBe(false)
  })
})

describe('UpdateWhatsAppQuickReplySchema', () => {
  it('should accept an empty object', () => {
    expect(UpdateWhatsAppQuickReplySchema.safeParse({}).success).toBe(true)
  })

  it('should accept a partial update of just the body', () => {
    const result = UpdateWhatsAppQuickReplySchema.safeParse({
      body: 'Nova mensagem',
    })
    expect(result.success).toBe(true)
  })
})
