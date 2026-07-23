export type CrmAiMessageRoleDTO = 'USER' | 'ASSISTANT'

export interface CrmAiConversationDTO {
  id: string
  workspaceId: string
  userId: string
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface CrmAiMessageDTO {
  id: string
  conversationId: string
  role: CrmAiMessageRoleDTO
  content: string
  createdAt: string
  attachments?: CrmAiAttachmentDTO[]
}

export type CrmAiAttachmentKindDTO = 'IMAGE' | 'DOCUMENT'

export interface CrmAiAttachmentDTO {
  id: string
  conversationId: string
  messageId: string | null
  kind: CrmAiAttachmentKindDTO
  filename: string
  contentType: string
  sizeBytes: number
  createdAt: string
  url: string | null
}
