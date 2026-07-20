import type { WhatsAppMessage } from '@prisma/client'
import type { WhatsAppMessageDTO } from '@/types/whatsapp-message'

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
    createdAt: message.createdAt.toISOString(),
  }
}
