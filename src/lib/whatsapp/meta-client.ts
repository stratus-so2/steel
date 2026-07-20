import 'server-only'
import { logger } from '@/lib/axiom/logger'
import type {
  WhatsAppOutboundMedia,
  WhatsAppOutboundReaction,
  WhatsAppOutboundTemplate,
  WhatsAppOutboundText,
  WhatsAppProviderClient,
  WhatsAppSendResult,
} from './types'

const META_GRAPH_VERSION = 'v23.0'
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`

export interface MetaCredentials {
  phoneNumberId: string
  wabaId: string
  accessToken: string
}

async function metaRequest<T>(
  credentials: MetaCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${META_GRAPH_BASE_URL}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.accessToken}`,
      ...init?.headers,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    logger.error('whatsapp.meta.request_failed', {
      path,
      status: response.status,
      body,
    })
    throw new Error(
      body?.error?.message ??
        `Falha na requisição Meta API (${response.status})`,
    )
  }

  return body as T
}

export function createMetaClient(
  credentials: MetaCredentials,
): WhatsAppProviderClient {
  const messagesPath = `/${credentials.phoneNumberId}/messages`

  return {
    async sendText({
      to,
      text,
      quotedProviderMessageId,
    }: WhatsAppOutboundText): Promise<WhatsAppSendResult> {
      const result = await metaRequest<{ messages: { id: string }[] }>(
        credentials,
        messagesPath,
        {
          method: 'POST',
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
            ...(quotedProviderMessageId
              ? { context: { message_id: quotedProviderMessageId } }
              : {}),
          }),
        },
      )
      return { providerMessageId: result.messages[0].id }
    },

    async sendMedia({
      to,
      mediaUrl,
      caption,
      type,
      quotedProviderMessageId,
    }: WhatsAppOutboundMedia): Promise<WhatsAppSendResult> {
      const result = await metaRequest<{ messages: { id: string }[] }>(
        credentials,
        messagesPath,
        {
          method: 'POST',
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type,
            [type]: { link: mediaUrl, ...(caption ? { caption } : {}) },
            ...(quotedProviderMessageId
              ? { context: { message_id: quotedProviderMessageId } }
              : {}),
          }),
        },
      )
      return { providerMessageId: result.messages[0].id }
    },

    async sendTemplate({
      to,
      templateName,
      language,
      components,
    }: WhatsAppOutboundTemplate): Promise<WhatsAppSendResult> {
      const result = await metaRequest<{ messages: { id: string }[] }>(
        credentials,
        messagesPath,
        {
          method: 'POST',
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: templateName,
              language: { code: language },
              ...(components ? { components } : {}),
            },
          }),
        },
      )
      return { providerMessageId: result.messages[0].id }
    },

    async sendReaction({
      to,
      providerMessageId,
      emoji,
    }: WhatsAppOutboundReaction): Promise<void> {
      await metaRequest(credentials, messagesPath, {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'reaction',
          reaction: { message_id: providerMessageId, emoji },
        }),
      })
    },

    async getConnectionStatus(): Promise<{ connected: boolean }> {
      try {
        await metaRequest(credentials, `/${credentials.phoneNumberId}`, {
          method: 'GET',
        })
        return { connected: true }
      } catch {
        return { connected: false }
      }
    },
  }
}
