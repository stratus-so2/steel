import { z } from 'zod'

export const CreateWhatsAppQuickReplySchema = z.object({
  shortcut: z.string().min(1, 'Atalho é obrigatório').max(50),
  title: z.string().min(1, 'Título é obrigatório').max(120),
  body: z.string().min(1, 'Mensagem é obrigatória').max(4096),
  mediaUrl: z.url().max(2048).optional(),
})

export type CreateWhatsAppQuickReplyDTO = z.infer<
  typeof CreateWhatsAppQuickReplySchema
>

export const UpdateWhatsAppQuickReplySchema = z.object({
  shortcut: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(4096).optional(),
  mediaUrl: z.url().max(2048).optional(),
})

export type UpdateWhatsAppQuickReplyDTO = z.infer<
  typeof UpdateWhatsAppQuickReplySchema
>
