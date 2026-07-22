import type { WhatsAppMessage } from '@prisma/client'
import type {
  WhatsAppMessageContactPayload,
  WhatsAppMessageDTO,
} from '@/types/whatsapp-message'

export function toWhatsAppMessageDTO(
  message: WhatsAppMessage,
): WhatsAppMessageDTO {
  return {
    id: message.id,
    workspaceId: message.workspaceId,
    conversationId: message.conversationId,
    direction: message.direction,
    type: message.type,
    text: message.text,
    mediaUrl: message.mediaUrl,
    status: message.status,
    senderUserId: message.senderUserId,
    sentByAi: message.sentByAi,
    replyToMessageId: message.replyToMessageId,
    reactionEmoji: message.reactionEmoji,
    reactedByContact: message.reactedByContact,
    contactPayload:
      (message.contactPayload as WhatsAppMessageContactPayload | null) ?? null,
    createdAt: message.createdAt.toISOString(),
  }
}
