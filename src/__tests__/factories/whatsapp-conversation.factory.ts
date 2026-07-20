import { createId } from '@paralleldrive/cuid2'
import type { WhatsAppConversation } from '@prisma/client'
import type { WhatsAppConversationWithPreview } from '@/src/repositories/whatsapp-conversation.repository'
import { createFakeWhatsAppContact } from './whatsapp-contact.factory'
import type { createFakeWhatsAppMessage } from './whatsapp-message.factory'

export function createFakeWhatsAppConversation(
  overrides?: Partial<WhatsAppConversation>,
): WhatsAppConversation {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    connectionId: createId(),
    contactId: createId(),
    status: 'NEW',
    assignedUserId: null,
    aiActive: false,
    aiHandoff: false,
    unreadCount: 0,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeWhatsAppConversationWithPreview(
  overrides?: Partial<WhatsAppConversation> & {
    contact?: ReturnType<typeof createFakeWhatsAppContact>
    messages?: ReturnType<typeof createFakeWhatsAppMessage>[]
  },
): WhatsAppConversationWithPreview {
  const { contact, messages, ...conversationOverrides } = overrides ?? {}
  const conversation = createFakeWhatsAppConversation(conversationOverrides)

  return {
    ...conversation,
    contact:
      contact ?? createFakeWhatsAppContact({ id: conversation.contactId }),
    messages: messages ?? [],
  }
}
