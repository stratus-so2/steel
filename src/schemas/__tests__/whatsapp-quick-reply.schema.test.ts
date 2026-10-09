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

  it('should drop the leading slash and outer spaces of the shortcut', () => {
    const result = CreateWhatsAppQuickReplySchema.safeParse({
      ...valid,
      shortcut: '  /Saudação ',
    })
    expect(result.success && result.data.shortcut).toBe('Saudação')
  })

  it('should reject a shortcut that is only a slash', () => {
    expect(
      CreateWhatsAppQuickReplySchema.safeParse({ ...valid, shortcut: '/' })
        .success,
    ).toBe(false)
  })

  it('should reject a shortcut with spaces', () => {
    const result = CreateWhatsAppQuickReplySchema.safeParse({
      ...valid,
      shortcut: 'boas vindas',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'O atalho não pode ter espaços',
    )
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

  it('should normalize the shortcut on update too', () => {
    const result = UpdateWhatsAppQuickReplySchema.safeParse({
      shortcut: '/preco',
    })
    expect(result.success && result.data.shortcut).toBe('preco')
  })

  it('should accept a partial update of just the body', () => {
    const result = UpdateWhatsAppQuickReplySchema.safeParse({
      body: 'Nova mensagem',
    })
    expect(result.success).toBe(true)
  })
})
