export type WhatsAppMessageDirectionDTO = 'IN' | 'OUT'

export type WhatsAppMessageTypeDTO =
  | 'TEXT'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'STICKER'
  | 'LOCATION'
  | 'TEMPLATE'
  | 'BUTTON'
  | 'CONTACT'

export type WhatsAppMessageStatusDTO =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'

export interface WhatsAppMessageContactPayload {
  name: string
  waId: string
}

export interface WhatsAppMessageDTO {
  id: string
  workspaceId: string
  conversationId: string
  direction: WhatsAppMessageDirectionDTO
  type: WhatsAppMessageTypeDTO
  text: string | null
  mediaUrl: string | null
  status: WhatsAppMessageStatusDTO
  senderUserId: string | null
  sentByAi: boolean
  replyToMessageId: string | null
  reactionEmoji: string | null
  reactedByContact: boolean | null
  contactPayload: WhatsAppMessageContactPayload | null
  createdAt: string
}
