import z from 'zod'

const DocumentTypeEnum = z.enum([
  'PREMISES',
  'PORTFOLIO',
  'PROPOSAL',
  'CONTRACT',
])

export const CreateCrmDocumentTemplateSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(300),
  content: z.string().max(500_000).default(''),
  contentJson: z.string().max(500_000).optional(),
  type: DocumentTypeEnum.default('PROPOSAL'),
})

export type CreateCrmDocumentTemplateDTO = z.infer<
  typeof CreateCrmDocumentTemplateSchema
>

export const ListCrmDocumentTemplatesQuerySchema = z.object({
  type: DocumentTypeEnum.optional(),
})

export type ListCrmDocumentTemplatesQueryDTO = z.infer<
  typeof ListCrmDocumentTemplatesQuerySchema
>
