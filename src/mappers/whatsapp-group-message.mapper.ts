import type { WhatsAppGroupMessage } from '@prisma/client'
import type { WhatsAppGroupMessageDTO } from '@/types/whatsapp-group-message'

export function toWhatsAppGroupMessageDTO(
  message: WhatsAppGroupMessage,
): WhatsAppGroupMessageDTO {
  return {
    id: message.id,
    workspaceId: message.workspaceId,
    groupId: message.groupId,
    direction: message.direction,
    type: message.type,
    text: message.text,
    mediaUrl: message.mediaUrl,
    status: message.status,
    senderUserId: message.senderUserId,
    senderWaId: message.senderWaId,
    senderName: message.senderName,
    createdAt: message.createdAt.toISOString(),
  }
}
