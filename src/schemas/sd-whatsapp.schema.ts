import { z } from 'zod'
import { sdId } from './sd-config.schema'

/** Texto livre pela aba WhatsApp do chamado. */
export const SdWhatsappSendTextSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Mensagem não pode ser vazia')
    .max(4096, 'Mensagem muito longa'),
})
export type SdWhatsappSendTextDTO = z.infer<typeof SdWhatsappSendTextSchema>

/** Modelo aprovado da Meta (obrigatório fora da janela de 24 h). */
export const SdWhatsappSendTemplateSchema = z.object({
  templateName: z.string().trim().min(1).max(512),
  language: z.string().trim().min(1).max(20),
  components: z.array(z.unknown()).max(20).optional(),
})
export type SdWhatsappSendTemplateDTO = z.infer<
  typeof SdWhatsappSendTemplateSchema
>

/** Legenda do envio de mídia (o arquivo vem no multipart `file`). */
export const SdWhatsappSendMediaSchema = z.object({
  caption: z.string().trim().max(1024).optional(),
})
export type SdWhatsappSendMediaDTO = z.infer<typeof SdWhatsappSendMediaSchema>

/** Limite do arquivo enviado pela aba (o WhatsApp aceita até 16–100 MB). */
export const SD_WHATSAPP_MEDIA_MAX_BYTES = 16 * 1024 * 1024

export const SD_WHATSAPP_MEDIA_TYPES = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'video/mp4': 'VIDEO',
  'audio/ogg': 'AUDIO',
  'audio/mpeg': 'AUDIO',
  'audio/aac': 'AUDIO',
  'audio/mp4': 'AUDIO',
  'application/pdf': 'DOCUMENT',
  'application/msword': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'DOCUMENT',
  'application/vnd.ms-excel': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'DOCUMENT',
  'text/plain': 'DOCUMENT',
} as const satisfies Record<string, 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'>

export type SdWhatsappMediaType =
  (typeof SD_WHATSAPP_MEDIA_TYPES)[keyof typeof SD_WHATSAPP_MEDIA_TYPES]

/** Vincula uma conversa existente (da conexão do ServiceDesk) ao chamado. */
export const SdWhatsappLinkSchema = z.object({ conversationId: sdId })
export type SdWhatsappLinkDTO = z.infer<typeof SdWhatsappLinkSchema>

/**
 * Inicia (ou retoma) a conversa com um número. Sem `waId`, usa o WhatsApp
 * do contato do chamado.
 */
export const SdWhatsappStartSchema = z.object({
  waId: z
    .string()
    .trim()
    .max(30)
    .regex(/^[\d\s()+-]*$/, 'Informe só o número (com DDI e DDD)')
    .optional(),
})
export type SdWhatsappStartDTO = z.infer<typeof SdWhatsappStartSchema>

export const SdWhatsappMessagesQuerySchema = z.object({
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type SdWhatsappMessagesQueryDTO = z.infer<
  typeof SdWhatsappMessagesQuerySchema
>

export const SdWhatsappConversationsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type SdWhatsappConversationsQueryDTO = z.infer<
  typeof SdWhatsappConversationsQuerySchema
>
