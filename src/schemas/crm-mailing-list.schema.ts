import z from 'zod'

export const CreateCrmMailingListSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(1000).optional(),
})

export type CreateCrmMailingListDTO = z.infer<typeof CreateCrmMailingListSchema>

export const UpdateCrmMailingListSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  description: z.string().max(1000).optional(),
})

export type UpdateCrmMailingListDTO = z.infer<typeof UpdateCrmMailingListSchema>

export const AddCrmMailingListMemberSchema = z.object({
  email: z.email(),
  name: z.string().max(200).optional(),
  personId: z.string().optional(),
})

export type AddCrmMailingListMemberDTO = z.infer<
  typeof AddCrmMailingListMemberSchema
>
