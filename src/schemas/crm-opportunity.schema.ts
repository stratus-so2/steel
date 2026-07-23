import z from 'zod'

export const CreateCrmOpportunitySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  amount: z.number().min(0).optional(),
  closeDate: z.coerce.date().optional(),
  // Pipeline/etapa são opcionais: quando omitidos, o service resolve o
  // pipeline padrão da workspace e sua primeira etapa. Se stageId é
  // informado, pipelineId também deve ser — o service valida essa
  // combinação e que a etapa pertence ao pipeline informado.
  pipelineId: z.string().min(1).optional(),
  stageId: z.string().min(1).optional(),
  companyId: z.string().optional(),
  pointOfContactId: z.string().optional(),
  ownerId: z.string().optional(),
  source: z.string().max(100).optional(),
})

export type CreateCrmOpportunityDTO = z.infer<typeof CreateCrmOpportunitySchema>

export const UpdateCrmOpportunitySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  amount: z.number().min(0).optional(),
  closeDate: z.coerce.date().optional(),
  pipelineId: z.string().min(1).optional(),
  stageId: z.string().min(1).optional(),
  companyId: z.string().optional(),
  pointOfContactId: z.string().optional(),
  ownerId: z.string().optional(),
  source: z.string().max(100).optional(),
})

export type UpdateCrmOpportunityDTO = z.infer<typeof UpdateCrmOpportunitySchema>

export const ReorderCrmOpportunitiesSchema = z.object({
  stageId: z.string().min(1),
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmOpportunitiesDTO = z.infer<
  typeof ReorderCrmOpportunitiesSchema
>

export const CreateCrmOpportunityLineItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0).default(0),
  discountPct: z.number().min(0).max(100).default(0),
  billingType: z.enum(['ONE_TIME', 'MONTHLY', 'YEARLY']).default('ONE_TIME'),
})

export type CreateCrmOpportunityLineItemDTO = z.infer<
  typeof CreateCrmOpportunityLineItemSchema
>

export const UpdateCrmOpportunityLineItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  billingType: z.enum(['ONE_TIME', 'MONTHLY', 'YEARLY']).optional(),
})

export type UpdateCrmOpportunityLineItemDTO = z.infer<
  typeof UpdateCrmOpportunityLineItemSchema
>
