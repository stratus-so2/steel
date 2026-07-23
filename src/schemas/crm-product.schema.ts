import z from 'zod'

export const CreateCrmProductSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  sku: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  unitPrice: z.number().min(0).default(0),
  currency: z.string().max(10).default('BRL'),
  billingType: z.enum(['ONE_TIME', 'MONTHLY', 'YEARLY']).default('ONE_TIME'),
  active: z.boolean().default(true),
})

export type CreateCrmProductDTO = z.infer<typeof CreateCrmProductSchema>

export const UpdateCrmProductSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  sku: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  unitPrice: z.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  billingType: z.enum(['ONE_TIME', 'MONTHLY', 'YEARLY']).optional(),
  active: z.boolean().optional(),
})

export type UpdateCrmProductDTO = z.infer<typeof UpdateCrmProductSchema>

export const ListCrmProductsSchema = z.object({
  active: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export type ListCrmProductsDTO = z.infer<typeof ListCrmProductsSchema>

export const ReorderCrmProductsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmProductsDTO = z.infer<typeof ReorderCrmProductsSchema>
