import z from 'zod'
import {
  emptyToNull,
  optionalEmail,
  optionalText,
  QueryBoolean,
  requiredText,
  SdCustomFieldValuesSchema,
  SdImportRowsSchema,
  SdOptionsQuerySchema,
  SdPageQuerySchema,
} from './sd-directory.schema'

export const SdCustomerKindEnum = z.enum(['CLIENT', 'COMPANY'])
export const SdPersonTypeEnum = z.enum(['INDIVIDUAL', 'LEGAL'])

/** Telefone em qualquer máscara; o service normaliza para dígitos. */
export function optionalPhone() {
  return z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(30)
      .regex(/^[\d\s()+.-]+$/, 'Telefone inválido')
      .nullable()
      .optional(),
  )
}

/** UF com 2 letras (maiúsculas). */
const optionalState = z.preprocess(
  (value) =>
    typeof value === 'string' ? emptyToNull(value.trim().toUpperCase()) : value,
  z
    .string()
    .regex(/^[A-Z]{2}$/, 'UF inválida')
    .nullable()
    .optional(),
)

/** CEP em qualquer máscara; guardado com 8 dígitos. */
const optionalZipCode = z.preprocess(
  (value) =>
    typeof value === 'string' ? emptyToNull(value.replace(/\D/g, '')) : value,
  z
    .string()
    .regex(/^\d{8}$/, 'CEP inválido')
    .nullable()
    .optional(),
)

const customerFields = {
  personType: SdPersonTypeEnum.optional(),
  tradeName: optionalText(200),
  /** CPF/CNPJ com ou sem máscara — validado no service (`SD_DOCUMENT_INVALID`). */
  document: optionalText(20),
  email: optionalEmail(),
  phone: optionalPhone(),
  whatsapp: optionalPhone(),
  zipCode: optionalZipCode,
  street: optionalText(200),
  number: optionalText(20),
  complement: optionalText(200),
  district: optionalText(120),
  city: optionalText(120),
  state: optionalState,
  ibgeCode: optionalText(7),
  notes: optionalText(5000),
}

export const CreateSdCustomerSchema = z.object({
  kind: SdCustomerKindEnum.default('CLIENT'),
  name: requiredText(200, 'Nome é obrigatório'),
  ...customerFields,
  country: z.string().trim().length(2).toUpperCase().default('BR'),
  customFields: SdCustomFieldValuesSchema.default({}),
  active: z.boolean().default(true),
})

export type CreateSdCustomerDTO = z.infer<typeof CreateSdCustomerSchema>

export const UpdateSdCustomerSchema = z.object({
  kind: SdCustomerKindEnum.optional(),
  name: requiredText(200, 'Nome é obrigatório').optional(),
  ...customerFields,
  country: z.string().trim().length(2).toUpperCase().optional(),
  customFields: SdCustomFieldValuesSchema.optional(),
  active: z.boolean().optional(),
})

export type UpdateSdCustomerDTO = z.infer<typeof UpdateSdCustomerSchema>

export const SdCustomerSortEnum = z.enum([
  'name',
  'tradeName',
  'document',
  'city',
  'createdAt',
  'updatedAt',
])

export const ListSdCustomersSchema = SdPageQuerySchema.extend({
  /** Busca em nome, fantasia, documento, e-mail e cidade. */
  q: z.string().trim().max(200).optional(),
  kind: SdCustomerKindEnum.optional(),
  active: QueryBoolean.optional(),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  city: z.string().trim().max(120).optional(),
  sort: SdCustomerSortEnum.default('name'),
})

export type ListSdCustomersDTO = z.infer<typeof ListSdCustomersSchema>

export const ImportSdCustomersSchema = SdImportRowsSchema.extend({
  kind: SdCustomerKindEnum,
})

export type ImportSdCustomersDTO = z.infer<typeof ImportSdCustomersSchema>

export const SdCustomerOptionsSchema = SdOptionsQuerySchema.extend({
  kind: SdCustomerKindEnum.optional(),
})

export type SdCustomerOptionsDTO = z.infer<typeof SdCustomerOptionsSchema>
