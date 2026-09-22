import z from 'zod'
import { optionalPhone } from './sd-customer.schema'
import {
  optionalEmail,
  optionalId,
  optionalText,
  QueryBoolean,
  requiredText,
  SdCustomFieldValuesSchema,
  SdOptionsQuerySchema,
  SdPageQuerySchema,
} from './sd-directory.schema'

/** Vínculo com um cliente/empresa; no máximo um principal. */
export const SdContactCustomerLinkSchema = z.object({
  customerId: z.string().min(1).max(64),
  isPrimary: z.boolean().default(false),
})

const customersField = z
  .array(SdContactCustomerLinkSchema)
  .max(50)
  .refine((links) => links.filter((l) => l.isPrimary).length <= 1, {
    message: 'Apenas um cliente/empresa pode ser o principal',
  })

const contactFields = {
  jobTitle: optionalText(120),
  email: optionalEmail(),
  phone: optionalPhone(),
  whatsapp: optionalPhone(),
  /** Usuário da plataforma (membro do workspace) que é este contato. */
  userId: optionalId(),
  notes: optionalText(5000),
}

export const CreateSdContactSchema = z.object({
  name: requiredText(200, 'Nome é obrigatório'),
  ...contactFields,
  customers: customersField.default([]),
  customFields: SdCustomFieldValuesSchema.default({}),
  active: z.boolean().default(true),
})

export type CreateSdContactDTO = z.infer<typeof CreateSdContactSchema>

export const UpdateSdContactSchema = z.object({
  name: requiredText(200, 'Nome é obrigatório').optional(),
  ...contactFields,
  /** Quando enviado, substitui todos os vínculos. */
  customers: customersField.optional(),
  customFields: SdCustomFieldValuesSchema.optional(),
  active: z.boolean().optional(),
})

export type UpdateSdContactDTO = z.infer<typeof UpdateSdContactSchema>

export const SdContactSortEnum = z.enum([
  'name',
  'jobTitle',
  'email',
  'createdAt',
  'updatedAt',
])

export const ListSdContactsSchema = SdPageQuerySchema.extend({
  /** Busca em nome, cargo, e-mail, telefone e WhatsApp. */
  q: z.string().trim().max(200).optional(),
  customerId: z.string().max(64).optional(),
  active: QueryBoolean.optional(),
  sort: SdContactSortEnum.default('name'),
})

export type ListSdContactsDTO = z.infer<typeof ListSdContactsSchema>

export const SdContactOptionsSchema = SdOptionsQuerySchema.extend({
  customerId: z.string().max(64).optional(),
})

export type SdContactOptionsDTO = z.infer<typeof SdContactOptionsSchema>

/** Busca de contato por canal (WhatsApp de entrada, e-mail). */
export const SdContactLookupSchema = z
  .object({
    whatsapp: z.string().trim().max(30).optional(),
    email: z.string().trim().max(320).optional(),
  })
  .refine((v) => Boolean(v.whatsapp || v.email), {
    message: 'Informe whatsapp ou email',
  })

export type SdContactLookupDTO = z.infer<typeof SdContactLookupSchema>
