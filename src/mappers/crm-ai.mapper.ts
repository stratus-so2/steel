import type {
  CrmAiAttachment,
  CrmAiConversation,
  CrmAiMessage,
} from '@prisma/client'
import type {
  CrmAiAttachmentDTO,
  CrmAiConversationDTO,
  CrmAiMessageDTO,
} from '@/types/crm-ai'

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

export function toCrmAiMessageDTO(
  message: CrmAiMessage,
  attachments?: CrmAiAttachmentDTO[],
): CrmAiMessageDTO {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    attachments,
  }
}

export function toCrmAiAttachmentDTO(
  attachment: CrmAiAttachment,
  url: string | null = null,
): CrmAiAttachmentDTO {
  return {
    id: attachment.id,
    conversationId: attachment.conversationId,
    messageId: attachment.messageId,
    kind: attachment.kind,
    filename: attachment.filename,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
    url,
  }
}
