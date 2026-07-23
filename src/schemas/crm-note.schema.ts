import z from 'zod'

export const CreateCrmNoteSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(20000).optional(),
  companyId: z.string().optional(),
  personId: z.string().optional(),
  opportunityId: z.string().optional(),
})

export type CreateCrmNoteDTO = z.infer<typeof CreateCrmNoteSchema>

export const UpdateCrmNoteSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(20000).optional(),
})

export type UpdateCrmNoteDTO = z.infer<typeof UpdateCrmNoteSchema>

export const ListCrmNotesSchema = z.object({
  companyId: z.string().optional(),
  personId: z.string().optional(),
  opportunityId: z.string().optional(),
})

export type ListCrmNotesDTO = z.infer<typeof ListCrmNotesSchema>
