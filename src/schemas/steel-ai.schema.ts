import z from 'zod'

export const AiConversationModeSchema = z.enum(['EXPLORE', 'AGENT'])

export const CreateAiConversationSchema = z.object({
  title: z.string().trim().max(200).optional(),
  mode: AiConversationModeSchema.default('EXPLORE'),
})
export type CreateAiConversationDTO = z.infer<typeof CreateAiConversationSchema>

export const UpdateAiConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    mode: AiConversationModeSchema,
    pinned: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateAiConversationDTO = z.infer<typeof UpdateAiConversationSchema>

export const SendAiMessageSchema = z.object({
  content: z.string().trim().min(1, 'Mensagem não pode ser vazia').max(8000),
  /** Switches the conversation mode for this and the next turns. */
  mode: AiConversationModeSchema.optional(),
})
export type SendAiMessageDTO = z.infer<typeof SendAiMessageSchema>

/**
 * Confirming a pending action. DELETE actions require `doubleConfirmed: true`
 * (the UI asks twice); the server rejects otherwise.
 */
export const ConfirmAiPendingActionSchema = z.object({
  doubleConfirmed: z.boolean().optional(),
})
export type ConfirmAiPendingActionDTO = z.infer<
  typeof ConfirmAiPendingActionSchema
>
