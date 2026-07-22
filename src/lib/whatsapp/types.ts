import 'server-only'

export interface WhatsAppSendResult {
  providerMessageId: string
}

export interface WhatsAppOutboundText {
  to: string
  text: string
  quotedProviderMessageId?: string
  // Z-API group mentions — phone numbers to highlight as @mentions. Ignored
  // by providers/targets that don't support it (Meta has no group support at all).
  mentionedWaIds?: string[]
}

export type WhatsAppOutboundMediaType = 'image' | 'audio' | 'video' | 'document'

export interface WhatsAppOutboundMedia {
  to: string
  mediaUrl: string
  type: WhatsAppOutboundMediaType
  caption?: string
  fileName?: string
  quotedProviderMessageId?: string
}

export interface WhatsAppOutboundReaction {
  to: string
  providerMessageId: string
  // Empty string removes the reaction.
  emoji: string
}

export interface WhatsAppOutboundTemplate {
  to: string
  templateName: string
  language: string
  components?: unknown[]
}

export interface WhatsAppOutboundContact {
  to: string
  name: string
  waId: string
}

export interface WhatsAppQrCode {
  status: 'connected' | 'awaiting_scan'
  qrCodeBase64?: string
}

export interface WhatsAppProviderClient {
  sendText(input: WhatsAppOutboundText): Promise<WhatsAppSendResult>
  sendMedia(input: WhatsAppOutboundMedia): Promise<WhatsAppSendResult>
  sendTemplate(input: WhatsAppOutboundTemplate): Promise<WhatsAppSendResult>
  sendContact(input: WhatsAppOutboundContact): Promise<WhatsAppSendResult>
  sendReaction(input: WhatsAppOutboundReaction): Promise<void>
  getConnectionStatus(): Promise<{ connected: boolean }>
}

export interface ZapiProviderClient extends WhatsAppProviderClient {
  getQrCode(): Promise<WhatsAppQrCode>
}
