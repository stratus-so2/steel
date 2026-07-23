import z from 'zod'
import { CustomFieldsInputSchema } from '@/src/schemas/crm-custom-field.schema'

const AddressSchema = z
  .object({
    street: z.string().max(200).optional(),
    number: z.string().max(20).optional(),
    complement: z.string().max(100).optional(),
    neighborhood: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(2).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
  })
  .optional()

export const CreateCrmCompanySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  cnpj: z.string().max(20).optional(),
  domain: z.string().max(200).optional(),
  employees: z.number().int().min(0).optional(),
  linkedin: z.string().max(300).optional(),
  address: AddressSchema,
  arr: z.number().min(0).optional(),
  icp: z.boolean().default(false),
  accountOwnerId: z.string().optional(),
  customFields: CustomFieldsInputSchema.optional(),
})

export type CreateCrmCompanyDTO = z.infer<typeof CreateCrmCompanySchema>

export const UpdateCrmCompanySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  cnpj: z.string().max(20).optional(),
  domain: z.string().max(200).optional(),
  employees: z.number().int().min(0).optional(),
  linkedin: z.string().max(300).optional(),
  address: AddressSchema,
  arr: z.number().min(0).optional(),
  icp: z.boolean().optional(),
  // Nullable: a coluna é limpável na grade (envia null para desvincular).
  accountOwnerId: z.string().nullable().optional(),
  customFields: CustomFieldsInputSchema.optional(),
})

export type UpdateCrmCompanyDTO = z.infer<typeof UpdateCrmCompanySchema>

export const ListCrmCompaniesSchema = z.object({
  icp: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export type ListCrmCompaniesDTO = z.infer<typeof ListCrmCompaniesSchema>

export const ReorderCrmCompaniesSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmCompaniesDTO = z.infer<typeof ReorderCrmCompaniesSchema>
