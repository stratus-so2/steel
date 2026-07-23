import z from 'zod'

export const CreateCrmIntegrationKeySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(150),
})

export type CreateCrmIntegrationKeyDTO = z.infer<
  typeof CreateCrmIntegrationKeySchema
>

export const IngestCrmLeadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  emails: z.array(z.email()).default([]),
  phones: z.array(z.string().max(30)).default([]),
  company: z.string().max(200).optional(),
  source: z.string().max(100).optional(),
})

export type IngestCrmLeadDTO = z.infer<typeof IngestCrmLeadSchema>
