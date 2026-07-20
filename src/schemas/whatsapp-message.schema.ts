import { z } from 'zod'

export const SendWhatsAppTextMessageSchema = z.object({
  text: z.string().min(1, 'Mensagem não pode ser vazia').max(4096),
})

export type SendWhatsAppTextMessageDTO = z.infer<
  typeof SendWhatsAppTextMessageSchema
>

export const SendWhatsAppMediaMessageSchema = z.object({
  mediaUrl: z.url(),
  type: z.enum(['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']),
  caption: z.string().max(1024).optional(),
  fileName: z.string().max(255).optional(),
})

export type SendWhatsAppMediaMessageDTO = z.infer<
  typeof SendWhatsAppMediaMessageSchema
>

export const SendWhatsAppTemplateMessageSchema = z.object({
  templateName: z.string().min(1),
  language: z.string().min(1).max(20),
  components: z.array(z.unknown()).optional(),
})

export type SendWhatsAppTemplateMessageDTO = z.infer<
  typeof SendWhatsAppTemplateMessageSchema
>

export const ListWhatsAppMessagesSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

export type ListWhatsAppMessagesDTO = z.infer<typeof ListWhatsAppMessagesSchema>
