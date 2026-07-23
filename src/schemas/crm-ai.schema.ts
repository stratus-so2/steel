import z from 'zod'

export const CreateCrmAiConversationSchema = z.object({
  title: z.string().max(200).optional(),
})

export type CreateCrmAiConversationDTO = z.infer<
  typeof CreateCrmAiConversationSchema
>

export const SendCrmAiMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode ser vazia').max(8000),
})

export type SendCrmAiMessageDTO = z.infer<typeof SendCrmAiMessageSchema>
