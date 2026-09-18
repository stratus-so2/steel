import { z } from 'zod'

export const StartWhatsAppConversationSchema = z.object({
  contactId: z.string().min(1, 'Contato é obrigatório'),
  connectionId: z.string().min(1, 'Conexão é obrigatória'),
})

export type StartWhatsAppConversationDTO = z.infer<
  typeof StartWhatsAppConversationSchema
>

export const CloseWhatsAppConversationSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, 'Motivo deve ter no máximo 500 caracteres')
    .optional()
    .transform((value) => value || undefined),
})

export type CloseWhatsAppConversationDTO = z.infer<
  typeof CloseWhatsAppConversationSchema
>
