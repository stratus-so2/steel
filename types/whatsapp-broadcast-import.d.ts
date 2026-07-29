import type { WhatsAppBroadcastListDTO } from './whatsapp-broadcast'

export interface WhatsAppBroadcastImportRejectedRowDTO {
  rowNumber: number
  reason: string
}

export interface WhatsAppBroadcastImportResultDTO {
  broadcastList: WhatsAppBroadcastListDTO | null
  createdCount: number
  rejectedRows: WhatsAppBroadcastImportRejectedRowDTO[]
}
