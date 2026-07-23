import z from 'zod'

export const CreateCrmEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  subject: z.string().min(1, 'Assunto é obrigatório').max(300),
  contentHtml: z.string().min(1, 'Conteúdo é obrigatório').max(200_000),
  contentJson: z.string().max(200_000).optional(),
})

export type CreateCrmEmailTemplateDTO = z.infer<
  typeof CreateCrmEmailTemplateSchema
>

export const UpdateCrmEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  subject: z.string().min(1, 'Assunto é obrigatório').max(300).optional(),
  contentHtml: z.string().min(1).max(200_000).optional(),
  contentJson: z.string().max(200_000).optional(),
})

export type UpdateCrmEmailTemplateDTO = z.infer<
  typeof UpdateCrmEmailTemplateSchema
>
