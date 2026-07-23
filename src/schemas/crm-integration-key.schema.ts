import z from 'zod'

export const CreateCrmIntegrationKeySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(150),
})

export type CreateCrmIntegrationKeyDTO = z.infer<
  typeof CreateCrmIntegrationKeySchema
>
