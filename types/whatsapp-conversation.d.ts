export type WhatsAppConversationStatusDTO = 'NEW' | 'IN_PROGRESS' | 'CLOSED'

export interface WhatsAppConversationDTO {
  id: string
  workspaceId: string
  connectionId: string
  contactId: string
  contactName: string | null
  contactWaId: string
  contactAvatarUrl: string | null
  status: WhatsAppConversationStatusDTO
  assignedUserId: string | null
  aiActive: boolean
  aiHandoff: boolean
  unreadCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  pinned: boolean
  archived: boolean
  contactSince: string
  createdAt: string
  updatedAt: string
}

export interface WhatsAppAssignableMemberDTO {
  id: string
  name: string
  email: string
  image: string | null
}
