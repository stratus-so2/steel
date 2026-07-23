import z from 'zod'

export const CreateCrmQuotaSchema = z.object({
  ownerId: z.string().min(1, 'Responsável é obrigatório'),
  period: z.enum(['MONTH', 'QUARTER']),
  periodKey: z.string().min(1, 'Período é obrigatório').max(20),
  targetAmount: z.number().min(0).default(0),
})

export type CreateCrmQuotaDTO = z.infer<typeof CreateCrmQuotaSchema>

export const UpdateCrmQuotaSchema = z.object({
  targetAmount: z.number().min(0).optional(),
})

export type UpdateCrmQuotaDTO = z.infer<typeof UpdateCrmQuotaSchema>

export const ListCrmQuotasSchema = z.object({
  ownerId: z.string().optional(),
  period: z.enum(['MONTH', 'QUARTER']).optional(),
})

export type ListCrmQuotasDTO = z.infer<typeof ListCrmQuotasSchema>
