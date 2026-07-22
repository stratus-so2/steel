export type WhatsAppGroupParticipantRoleDTO = 'MEMBER' | 'ADMIN'

export interface WhatsAppGroupParticipantDTO {
  waId: string
  name: string | null
  role: WhatsAppGroupParticipantRoleDTO
}

export interface WhatsAppGroupDTO {
  id: string
  workspaceId: string
  connectionId: string
  groupJid: string
  name: string
  imageUrl: string | null
  description: string | null
  inviteLink: string | null
  archived: boolean
  lastMessageAt: string | null
  lastMessagePreview: string | null
  participants: WhatsAppGroupParticipantDTO[]
  createdAt: string
  updatedAt: string
}
