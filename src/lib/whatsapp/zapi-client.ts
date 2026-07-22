import 'server-only'
import { logger } from '@/lib/axiom/logger'
import type {
  WhatsAppOutboundContact,
  WhatsAppOutboundMedia,
  WhatsAppOutboundReaction,
  WhatsAppOutboundText,
  WhatsAppQrCode,
  WhatsAppSendResult,
  ZapiProviderClient,
} from './types'

const ZAPI_BASE_URL = 'https://api.z-api.io'

export interface ZapiCredentials {
  instanceId: string
  token: string
  clientToken?: string
}

async function zapiRequest<T>(
  credentials: ZapiCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${ZAPI_BASE_URL}/instances/${credentials.instanceId}/token/${credentials.token}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(credentials.clientToken
        ? { 'Client-Token': credentials.clientToken }
        : {}),
      ...init?.headers,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    logger.error('whatsapp.zapi.request_failed', {
      path,
      status: response.status,
      body,
    })
    throw new Error(
      body?.message ?? `Falha na requisição Z-API (${response.status})`,
    )
  }

  return body as T
}

const MEDIA_ENDPOINT_BY_TYPE: Record<WhatsAppOutboundMedia['type'], string> = {
  image: '/send-image',
  audio: '/send-audio',
  video: '/send-video',
  document: '/send-document',
}

const MEDIA_PAYLOAD_KEY_BY_TYPE: Record<WhatsAppOutboundMedia['type'], string> =
  {
    image: 'image',
    audio: 'audio',
    video: 'video',
    document: 'document',
  }

export function createZapiClient(
  credentials: ZapiCredentials,
): ZapiProviderClient {
  return {
    async sendText({
      to,
      text,
      quotedProviderMessageId,
    }: WhatsAppOutboundText): Promise<WhatsAppSendResult> {
      const result = await zapiRequest<{ messageId: string }>(
        credentials,
        '/send-text',
        {
          method: 'POST',
          body: JSON.stringify({
            phone: to,
            message: text,
            ...(quotedProviderMessageId
              ? { messageId: quotedProviderMessageId }
              : {}),
          }),
        },
      )
      return { providerMessageId: result.messageId }
    },

    async sendMedia({
      to,
      mediaUrl,
      caption,
      type,
      fileName,
      quotedProviderMessageId,
    }: WhatsAppOutboundMedia): Promise<WhatsAppSendResult> {
      const result = await zapiRequest<{ messageId: string }>(
        credentials,
        MEDIA_ENDPOINT_BY_TYPE[type],
        {
          method: 'POST',
          body: JSON.stringify({
            phone: to,
            [MEDIA_PAYLOAD_KEY_BY_TYPE[type]]: mediaUrl,
            ...(caption ? { caption } : {}),
            ...(fileName ? { fileName } : {}),
            ...(quotedProviderMessageId
              ? { messageId: quotedProviderMessageId }
              : {}),
          }),
        },
      )
      return { providerMessageId: result.messageId }
    },

    async sendTemplate(): Promise<WhatsAppSendResult> {
      throw new Error('Z-API não suporta templates de mensagem da Meta')
    },

    async sendContact({
      to,
      name,
      waId,
    }: WhatsAppOutboundContact): Promise<WhatsAppSendResult> {
      const result = await zapiRequest<{ messageId: string }>(
        credentials,
        '/send-contact',
        {
          method: 'POST',
          body: JSON.stringify({
            phone: to,
            contactName: name,
            contactPhone: waId,
          }),
        },
      )
      return { providerMessageId: result.messageId }
    },

    async sendReaction({
      to,
      providerMessageId,
      emoji,
    }: WhatsAppOutboundReaction): Promise<void> {
      await zapiRequest(credentials, '/send-reaction', {
        method: 'POST',
        body: JSON.stringify({
          phone: to,
          messageId: providerMessageId,
          reaction: emoji,
        }),
      })
    },

    async getConnectionStatus(): Promise<{ connected: boolean }> {
      const result = await zapiRequest<{ connected: boolean }>(
        credentials,
        '/status',
      )
      return { connected: Boolean(result.connected) }
    },

    async getQrCode(): Promise<WhatsAppQrCode> {
      const status = await zapiRequest<{ connected: boolean }>(
        credentials,
        '/status',
      )
      if (status.connected) return { status: 'connected' }

      const qr = await zapiRequest<{ value: string }>(
        credentials,
        '/qr-code/image',
      )
      return { status: 'awaiting_scan', qrCodeBase64: qr.value }
    },
  }
}
