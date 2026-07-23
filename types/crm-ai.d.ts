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
}
