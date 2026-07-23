import type { CrmAiConversation, CrmAiMessage } from '@prisma/client'
import type { CrmAiConversationDTO, CrmAiMessageDTO } from '@/types/crm-ai'

export function toCrmAiConversationDTO(
  conversation: CrmAiConversation,
): CrmAiConversationDTO {
  return {
    id: conversation.id,
    workspaceId: conversation.workspaceId,
    userId: conversation.userId,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  }
}

export function toCrmAiMessageDTO(message: CrmAiMessage): CrmAiMessageDTO {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }
}
