export interface WhatsAppContactDTO {
  id: string
  workspaceId: string
  waId: string
  name: string | null
  avatarUrl: string | null
  description: string | null
  conversationCount: number
  createdAt: string
  updatedAt: string
}
