import { describe, expect, it } from 'vitest'
import {
  ListWhatsAppMessagesSchema,
  SendWhatsAppMediaMessageSchema,
  SendWhatsAppTemplateMessageSchema,
  SendWhatsAppTextMessageSchema,
} from '../whatsapp-message.schema'

describe('SendWhatsAppTextMessageSchema', () => {
  it('should accept a non-empty text', () => {
    expect(
      SendWhatsAppTextMessageSchema.safeParse({ text: 'Olá!' }).success,
    ).toBe(true)
  })

  it('should reject an empty text', () => {
    expect(SendWhatsAppTextMessageSchema.safeParse({ text: '' }).success).toBe(
      false,
    )
  })

  it('should reject text longer than 4096 characters', () => {
    expect(
      SendWhatsAppTextMessageSchema.safeParse({ text: 'a'.repeat(4097) })
        .success,
    ).toBe(false)
  })
})

describe('SendWhatsAppMediaMessageSchema', () => {
  const valid = {
    mediaUrl: 'https://minio.internal/whatsapp-media/file.jpg',
    type: 'IMAGE' as const,
  }

  it('should accept a valid media payload', () => {
    expect(SendWhatsAppMediaMessageSchema.safeParse(valid).success).toBe(true)
  })

  it('should reject an unknown media type', () => {
    expect(
      SendWhatsAppMediaMessageSchema.safeParse({
        ...valid,
        type: 'STICKER',
      }).success,
    ).toBe(false)
  })

  it('should reject a non-URL mediaUrl', () => {
    expect(
      SendWhatsAppMediaMessageSchema.safeParse({
        ...valid,
        mediaUrl: 'not-a-url',
      }).success,
    ).toBe(false)
  })
})

describe('SendWhatsAppTemplateMessageSchema', () => {
  it('should accept a template with name and language', () => {
    expect(
      SendWhatsAppTemplateMessageSchema.safeParse({
        templateName: 'boas_vindas',
        language: 'pt_BR',
      }).success,
    ).toBe(true)
  })

  it('should reject a missing templateName', () => {
    expect(
      SendWhatsAppTemplateMessageSchema.safeParse({ language: 'pt_BR' })
        .success,
    ).toBe(false)
  })
})

describe('ListWhatsAppMessagesSchema', () => {
  it('should default limit to 50', () => {
    const result = ListWhatsAppMessagesSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.limit).toBe(50)
  })

  it('should coerce a string limit to a number', () => {
    const result = ListWhatsAppMessagesSchema.safeParse({ limit: '20' })
    expect(result.success).toBe(true)
    expect(result.data?.limit).toBe(20)
  })

  it('should reject a limit above 100', () => {
    expect(ListWhatsAppMessagesSchema.safeParse({ limit: '500' }).success).toBe(
      false,
    )
  })
})
