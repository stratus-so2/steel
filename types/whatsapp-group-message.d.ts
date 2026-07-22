import type {
  WhatsAppMessageDirectionDTO,
  WhatsAppMessageTypeDTO,
} from './whatsapp-message'

export type WhatsAppGroupMessageStatusDTO =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'

export interface WhatsAppGroupMessageDTO {
  id: string
  workspaceId: string
  groupId: string
  direction: WhatsAppMessageDirectionDTO
  type: WhatsAppMessageTypeDTO
  text: string | null
  mediaUrl: string | null
  status: WhatsAppGroupMessageStatusDTO
  senderUserId: string | null
  senderWaId: string | null
  senderName: string | null
  createdAt: string
}
