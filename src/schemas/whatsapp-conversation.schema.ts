import { z } from 'zod'

export const StartWhatsAppConversationSchema = z.object({
  contactId: z.string().min(1, 'Contato é obrigatório'),
  connectionId: z.string().min(1, 'Conexão é obrigatória'),
})

export type StartWhatsAppConversationDTO = z.infer<
  typeof StartWhatsAppConversationSchema
>
