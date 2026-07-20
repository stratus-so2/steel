import 'server-only'

export interface WhatsAppSendResult {
  providerMessageId: string
}

export interface WhatsAppOutboundText {
  to: string
  text: string
}

export type WhatsAppOutboundMediaType = 'image' | 'audio' | 'video' | 'document'

export interface WhatsAppOutboundMedia {
  to: string
  mediaUrl: string
  type: WhatsAppOutboundMediaType
  caption?: string
  fileName?: string
}

export interface WhatsAppOutboundTemplate {
  to: string
  templateName: string
  language: string
  components?: unknown[]
}

export interface WhatsAppQrCode {
  status: 'connected' | 'awaiting_scan'
  qrCodeBase64?: string
}

export interface WhatsAppProviderClient {
  sendText(input: WhatsAppOutboundText): Promise<WhatsAppSendResult>
  sendMedia(input: WhatsAppOutboundMedia): Promise<WhatsAppSendResult>
  sendTemplate(input: WhatsAppOutboundTemplate): Promise<WhatsAppSendResult>
  getConnectionStatus(): Promise<{ connected: boolean }>
}

export interface ZapiProviderClient extends WhatsAppProviderClient {
  getQrCode(): Promise<WhatsAppQrCode>
}
