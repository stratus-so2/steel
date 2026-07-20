import type { WhatsAppQuickReply } from '@prisma/client'
import type { WhatsAppQuickReplyDTO } from '@/types/whatsapp-quick-reply'

export function toWhatsAppQuickReplyDTO(
  quickReply: WhatsAppQuickReply,
): WhatsAppQuickReplyDTO {
  return {
    id: quickReply.id,
    workspaceId: quickReply.workspaceId,
    shortcut: quickReply.shortcut,
    title: quickReply.title,
    body: quickReply.body,
    mediaUrl: quickReply.mediaUrl,
    createdAt: quickReply.createdAt.toISOString(),
    updatedAt: quickReply.updatedAt.toISOString(),
  }
}
