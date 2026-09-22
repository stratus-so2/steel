import { z } from 'zod'

/** Comentários do editor da KB (discussões ancoradas numa marca do Plate). */

const SdKbCommentContentSchema = z
  .array(z.record(z.string(), z.unknown()))
  .min(1, 'Comentário vazio')
  .refine(
    (value) => JSON.stringify(value).length <= 20_000,
    'Comentário excede o tamanho permitido',
  )

export const CreateSdKbCommentSchema = z.object({
  markId: z.string().min(1).max(64),
  content: SdKbCommentContentSchema,
  parentId: z.string().trim().min(1).max(64).optional(),
})

export type CreateSdKbCommentDTO = z.infer<typeof CreateSdKbCommentSchema>

export const UpdateSdKbCommentSchema = z.object({
  content: SdKbCommentContentSchema,
})

export type UpdateSdKbCommentDTO = z.infer<typeof UpdateSdKbCommentSchema>

export const ResolveSdKbCommentSchema = z.object({
  resolved: z.boolean(),
})

export type ResolveSdKbCommentDTO = z.infer<typeof ResolveSdKbCommentSchema>
