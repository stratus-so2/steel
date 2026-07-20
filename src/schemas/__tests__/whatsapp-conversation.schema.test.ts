import { describe, expect, it } from 'vitest'
import { StartWhatsAppConversationSchema } from '../whatsapp-conversation.schema'

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
