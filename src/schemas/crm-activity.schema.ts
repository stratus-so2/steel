import z from 'zod'

export const ListCrmActivitiesSchema = z.object({
  companyId: z.string().optional(),
  personId: z.string().optional(),
  opportunityId: z.string().optional(),
})

export type ListCrmActivitiesDTO = z.infer<typeof ListCrmActivitiesSchema>
