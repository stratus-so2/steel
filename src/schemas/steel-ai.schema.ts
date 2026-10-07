import z from 'zod'
import { AI_ATTACHMENT_MAX_PER_MESSAGE } from '@/src/lib/ai/attachments'

/** "<provider>:<model>" from the catalog; usability is checked by the service. */
export const AiModelKeyInputSchema = z.string().trim().min(3).max(100)

export const AiConversationModeSchema = z.enum([
  'EXPLORE',
  'AGENT',
  'AUTOPILOT',
])

export const CreateAiConversationSchema = z.object({
  title: z.string().trim().max(200).optional(),
  mode: AiConversationModeSchema.default('EXPLORE'),
  /** Model picked for the conversation (null/absent = default). */
  modelKey: AiModelKeyInputSchema.nullable().optional(),
})
export type CreateAiConversationDTO = z.infer<typeof CreateAiConversationSchema>

export const UpdateAiConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    mode: AiConversationModeSchema,
    pinned: z.boolean(),
    /** null = back to the default model. */
    modelKey: AiModelKeyInputSchema.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateAiConversationDTO = z.infer<typeof UpdateAiConversationSchema>

export const SendAiMessageSchema = z
  .object({
    /** May be empty when the message only carries attachments. */
    content: z.string().trim().max(8000).default(''),
    /** Switches the conversation mode for this and the next turns. */
    mode: AiConversationModeSchema.optional(),
    /** Switches the conversation model for this and the next turns. */
    modelKey: AiModelKeyInputSchema.optional(),
    /** Files uploaded to this conversation and not sent yet. */
    attachmentIds: z
      .array(z.string().min(1).max(64))
      .max(
        AI_ATTACHMENT_MAX_PER_MESSAGE,
        `No máximo ${AI_ATTACHMENT_MAX_PER_MESSAGE} anexos por mensagem`,
      )
      .default([]),
  })
  .refine((v) => v.content.length > 0 || v.attachmentIds.length > 0, {
    message: 'Mensagem não pode ser vazia',
    path: ['content'],
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

/** `GET .../ai/conversations?q=` — title search. */
export const ListAiConversationsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
})
export type ListAiConversationsQueryDTO = z.infer<
  typeof ListAiConversationsQuerySchema
>

export const AiPendingActionStatusSchema = z.enum([
  'PENDING',
  'EXECUTED',
  'FAILED',
  'CANCELED',
  'EXPIRED',
])

/** `GET .../ai/actions?status=&conversationId=` — the caller's own actions. */
export const ListAiPendingActionsQuerySchema = z.object({
  status: AiPendingActionStatusSchema.optional(),
  conversationId: z.string().min(1).max(64).optional(),
})
export type ListAiPendingActionsQueryDTO = z.infer<
  typeof ListAiPendingActionsQuerySchema
>
