import z from 'zod'

const LeadStatusEnum = z.enum([
  'NEW',
  'WORKING',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
])

export const CreateCrmLeadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  emails: z.array(z.email()).default([]),
  phones: z.array(z.string().max(30)).default([]),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(150).optional(),
  city: z.string().max(100).optional(),
  linkedin: z.string().max(300).optional(),
  source: z.string().max(100).optional(),
  status: LeadStatusEnum.default('NEW'),
})

export type CreateCrmLeadDTO = z.infer<typeof CreateCrmLeadSchema>

export const UpdateCrmLeadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  emails: z.array(z.email()).optional(),
  phones: z.array(z.string().max(30)).optional(),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(150).optional(),
  city: z.string().max(100).optional(),
  linkedin: z.string().max(300).optional(),
  source: z.string().max(100).optional(),
  status: LeadStatusEnum.optional(),
  ownerId: z.string().optional(),
})

export type UpdateCrmLeadDTO = z.infer<typeof UpdateCrmLeadSchema>

export const ListCrmLeadsSchema = z.object({
  status: LeadStatusEnum.optional(),
})

export type ListCrmLeadsDTO = z.infer<typeof ListCrmLeadsSchema>

export const ReorderCrmLeadsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmLeadsDTO = z.infer<typeof ReorderCrmLeadsSchema>

const LeadRuleFieldEnum = z.enum([
  'name',
  'email',
  'phone',
  'company',
  'jobTitle',
  'source',
  'city',
])

const LeadRuleOperatorEnum = z.enum([
  'equals',
  'not_equals',
  'contains',
  'is_empty',
  'is_not_empty',
])

export const CreateCrmLeadScoringRuleSchema = z.object({
  field: LeadRuleFieldEnum,
  operator: LeadRuleOperatorEnum,
  value: z.string().max(200).optional(),
  points: z.number().int().default(0),
  active: z.boolean().default(true),
})

export type CreateCrmLeadScoringRuleDTO = z.infer<
  typeof CreateCrmLeadScoringRuleSchema
>

export const UpdateCrmLeadScoringRuleSchema = z.object({
  field: LeadRuleFieldEnum.optional(),
  operator: LeadRuleOperatorEnum.optional(),
  value: z.string().max(200).optional(),
  points: z.number().int().optional(),
  active: z.boolean().optional(),
})

export type UpdateCrmLeadScoringRuleDTO = z.infer<
  typeof UpdateCrmLeadScoringRuleSchema
>

export const CreateCrmLeadRoutingRuleSchema = z.object({
  field: LeadRuleFieldEnum,
  operator: LeadRuleOperatorEnum,
  value: z.string().max(200).optional(),
  ownerId: z.string().min(1, 'Responsável é obrigatório'),
  active: z.boolean().default(true),
})

export type CreateCrmLeadRoutingRuleDTO = z.infer<
  typeof CreateCrmLeadRoutingRuleSchema
>

export const UpdateCrmLeadRoutingRuleSchema = z.object({
  field: LeadRuleFieldEnum.optional(),
  operator: LeadRuleOperatorEnum.optional(),
  value: z.string().max(200).optional(),
  ownerId: z.string().min(1).optional(),
  active: z.boolean().optional(),
})

export type UpdateCrmLeadRoutingRuleDTO = z.infer<
  typeof UpdateCrmLeadRoutingRuleSchema
>
