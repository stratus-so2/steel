import z from 'zod'

// Escopo reduzido em relação ao motor de grafo (nodes/edges/branching) do CRM
// original: aqui a definition é uma lista sequencial de nodes, sem ramificação.
export const CRM_WORKFLOW_NODE_TYPES = [
  'CREATE_PERSON',
  'CREATE_TASK',
  'SEND_EMAIL',
] as const
export type CrmWorkflowNodeType = (typeof CRM_WORKFLOW_NODE_TYPES)[number]

export const CrmWorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(CRM_WORKFLOW_NODE_TYPES),
  config: z.record(z.string(), z.unknown()),
})

export const CrmWorkflowDefinitionSchema = z.object({
  nodes: z.array(CrmWorkflowNodeSchema).min(1, 'Adicione ao menos um node'),
})

export type CrmWorkflowDefinitionDTO = z.infer<
  typeof CrmWorkflowDefinitionSchema
>

export const CreateCrmWorkflowSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(1000).optional(),
  triggerType: z.enum(['MANUAL', 'WEBHOOK']),
  definition: CrmWorkflowDefinitionSchema,
})

export type CreateCrmWorkflowDTO = z.infer<typeof CreateCrmWorkflowSchema>

export const UpdateCrmWorkflowSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  description: z.string().max(1000).optional(),
  triggerType: z.enum(['MANUAL', 'WEBHOOK']).optional(),
  definition: CrmWorkflowDefinitionSchema.optional(),
})

export type UpdateCrmWorkflowDTO = z.infer<typeof UpdateCrmWorkflowSchema>

export const RunCrmWorkflowSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type RunCrmWorkflowDTO = z.infer<typeof RunCrmWorkflowSchema>
