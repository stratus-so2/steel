export type WhatsAppBroadcastStatusDTO =
  | 'DRAFT'
  | 'QUEUED'
  | 'RUNNING'
  | 'DONE'
  | 'FAILED'

export type WhatsAppBroadcastRecipientStatusDTO = 'PENDING' | 'SENT' | 'FAILED'

export interface WhatsAppBroadcastRecipientDTO {
  id: string
  contactId: string
  contactName: string | null
  contactWaId: string
  status: WhatsAppBroadcastRecipientStatusDTO
  errorMessage: string | null
  sentAt: string | null
}

export interface WhatsAppBroadcastListDTO {
  id: string
  workspaceId: string
  connectionId: string
  name: string
  messageBody: string
  mediaUrl: string | null
  status: WhatsAppBroadcastStatusDTO
  scheduledAt: string | null
  createdById: string
  recipientCount: number
  sentCount: number
  failedCount: number
  createdAt: string
  updatedAt: string
}

export interface WhatsAppBroadcastListDetailDTO extends WhatsAppBroadcastListDTO {
  recipients: WhatsAppBroadcastRecipientDTO[]
}
