import { describe, expect, it } from 'vitest'
import {
  CloseWhatsAppConversationSchema,
  StartWhatsAppConversationSchema,
} from '../whatsapp-conversation.schema'

describe('StartWhatsAppConversationSchema', () => {
  it('should accept a valid payload', () => {
    const result = StartWhatsAppConversationSchema.safeParse({
      contactId: 'contact-1',
      connectionId: 'connection-1',
    })
    expect(result.success).toBe(true)
  })

  it('should reject a missing contactId', () => {
    expect(
      StartWhatsAppConversationSchema.safeParse({
        connectionId: 'connection-1',
      }).success,
    ).toBe(false)
  })

  it('should reject a missing connectionId', () => {
    expect(
      StartWhatsAppConversationSchema.safeParse({ contactId: 'contact-1' })
        .success,
    ).toBe(false)
  })
})

describe('CloseWhatsAppConversationSchema', () => {
  it('should accept an empty body (reason is optional)', () => {
    const result = CloseWhatsAppConversationSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.reason).toBeUndefined()
  })

  it('should trim the reason and drop a blank one', () => {
    expect(
      CloseWhatsAppConversationSchema.parse({ reason: '  Resolvido  ' }).reason,
    ).toBe('Resolvido')
    expect(
      CloseWhatsAppConversationSchema.parse({ reason: '   ' }).reason,
    ).toBeUndefined()
  })

  it('should reject a reason longer than 500 characters', () => {
    expect(
      CloseWhatsAppConversationSchema.safeParse({ reason: 'a'.repeat(501) })
        .success,
    ).toBe(false)
  })
})
