import { z } from 'zod'

export const CreateWhatsAppBroadcastSchema = z.object({
  connectionId: z.string().min(1, 'Conexão é obrigatória'),
  name: z.string().min(1, 'Nome é obrigatório').max(120),
  messageBody: z.string().min(1, 'Mensagem é obrigatória').max(4096),
  mediaUrl: z.url().max(2048).optional(),
  contactIds: z
    .array(z.string().min(1))
    .min(1, 'Selecione ao menos um contato')
    .max(1000, 'Máximo de 1000 contatos por lista'),
})

export type CreateWhatsAppBroadcastDTO = z.infer<
  typeof CreateWhatsAppBroadcastSchema
>
