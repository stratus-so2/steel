import z from 'zod'

export const CreateCrmPipelineSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  isDefault: z.boolean().default(false),
})

export type CreateCrmPipelineDTO = z.infer<typeof CreateCrmPipelineSchema>

export const UpdateCrmPipelineSchema = CreateCrmPipelineSchema.partial()

export type UpdateCrmPipelineDTO = z.infer<typeof UpdateCrmPipelineSchema>

export const ReorderCrmPipelinesSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmPipelinesDTO = z.infer<typeof ReorderCrmPipelinesSchema>

export const CreateCrmPipelineStageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  probability: z.number().int().min(0).max(100).default(0),
  category: z.enum(['OPEN', 'WON', 'LOST']).default('OPEN'),
  color: z.string().max(20).optional(),
})

export type CreateCrmPipelineStageDTO = z.infer<
  typeof CreateCrmPipelineStageSchema
>

export const UpdateCrmPipelineStageSchema =
  CreateCrmPipelineStageSchema.partial()

export type UpdateCrmPipelineStageDTO = z.infer<
  typeof UpdateCrmPipelineStageSchema
>

export const ReorderCrmPipelineStagesSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmPipelineStagesDTO = z.infer<
  typeof ReorderCrmPipelineStagesSchema
>
