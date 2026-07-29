import { describe, expect, it } from 'vitest'
import { createFakeWhatsAppContact } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { createFakeWhatsAppConversationWithPreview } from '@/src/__tests__/factories/whatsapp-conversation.factory'
import { createFakeWhatsAppMessage } from '@/src/__tests__/factories/whatsapp-message.factory'
import { toWhatsAppConversationDTO } from '../whatsapp-conversation.mapper'

describe('toWhatsAppConversationDTO()', () => {
  it('should map contact fields onto the conversation DTO', () => {
    const contact = createFakeWhatsAppContact({
      name: 'Maria Silva',
      waId: '5511988887777',
      avatarUrl: null,
    })
    const conversation = createFakeWhatsAppConversationWithPreview({
      contact,
      messages: [],
    })

    const dto = toWhatsAppConversationDTO(conversation)

    expect(dto.contactName).toBe('Maria Silva')
    expect(dto.contactWaId).toBe('5511988887777')
    expect(dto.lastMessagePreview).toBeNull()
  })

  it('should use the last message text as the preview', () => {
    const lastMessage = createFakeWhatsAppMessage({
      type: 'TEXT',
      text: 'Até mais tarde!',
    })
    const conversation = createFakeWhatsAppConversationWithPreview({
      messages: [lastMessage],
    })

    const dto = toWhatsAppConversationDTO(conversation)

    expect(dto.lastMessagePreview).toBe('Até mais tarde!')
  })

  it('should fall back to a type label when the last message has no text', () => {
    const lastMessage = createFakeWhatsAppMessage({ type: 'AUDIO', text: null })
    const conversation = createFakeWhatsAppConversationWithPreview({
      messages: [lastMessage],
    })

    const dto = toWhatsAppConversationDTO(conversation)

    expect(dto.lastMessagePreview).toContain('Áudio')
  })

  it('should serialize lastMessageAt as null when the conversation has no messages yet', () => {
    const conversation = createFakeWhatsAppConversationWithPreview({
      lastMessageAt: null,
      messages: [],
    })

    const dto = toWhatsAppConversationDTO(conversation)

    expect(dto.lastMessageAt).toBeNull()
  })

  it('should map avgSentimentScore through, null by default', () => {
    const withoutSentiment = createFakeWhatsAppConversationWithPreview()
    expect(
      toWhatsAppConversationDTO(withoutSentiment).avgSentimentScore,
    ).toBeNull()

    const withSentiment = createFakeWhatsAppConversationWithPreview({
      avgSentimentScore: 0.42,
    })
    expect(toWhatsAppConversationDTO(withSentiment).avgSentimentScore).toBe(
      0.42,
    )
  })
})
