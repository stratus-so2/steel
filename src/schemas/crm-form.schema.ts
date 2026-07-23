import z from 'zod'

const FormActionEnum = z.enum(['COMPANY', 'PERSON', 'LEAD'])

const FormFieldDefinitionSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(150),
  type: z.enum(['text', 'email', 'phone', 'textarea']),
  required: z.boolean().default(false),
})

export const CreateCrmFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(2000).optional(),
  action: FormActionEnum.default('LEAD'),
  fields: z.array(FormFieldDefinitionSchema).default([]),
  successMessage: z.string().max(500).optional(),
  redirectUrl: z.string().max(500).optional(),
})

export type CreateCrmFormDTO = z.infer<typeof CreateCrmFormSchema>

export const UpdateCrmFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(FormFieldDefinitionSchema).optional(),
  successMessage: z.string().max(500).optional(),
  redirectUrl: z.string().max(500).optional(),
})

export type UpdateCrmFormDTO = z.infer<typeof UpdateCrmFormSchema>

export const ReorderCrmFormsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmFormsDTO = z.infer<typeof ReorderCrmFormsSchema>

export const SubmitCrmFormSchema = z.object({
  values: z.record(z.string(), z.string()),
})

export type SubmitCrmFormDTO = z.infer<typeof SubmitCrmFormSchema>
