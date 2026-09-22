import z from 'zod'
import {
  emptyToNull,
  optionalDate,
  optionalId,
  optionalText,
  requiredText,
  SdCustomFieldValuesSchema,
  SdOptionsQuerySchema,
  SdPageQuerySchema,
} from './sd-directory.schema'

/* ------------------------------ tipos de CI ------------------------------ */

export const SdCiAttributeTypeEnum = z.enum([
  'text',
  'number',
  'date',
  'select',
  'boolean',
])

export const SdCiAttributeDefinitionSchema = z
  .object({
    key: z
      .string()
      .regex(
        /^[a-z][a-z0-9_]{0,49}$/,
        'Chave: minúsculas, números e _ (começando por letra)',
      ),
    label: requiredText(100, 'Rótulo é obrigatório'),
    type: SdCiAttributeTypeEnum,
    options: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    required: z.boolean().optional(),
  })
  .refine((def) => def.type !== 'select' || (def.options?.length ?? 0) > 0, {
    message: 'Atributo de seleção precisa de opções',
    path: ['options'],
  })

const attributeSchemaField = z
  .array(SdCiAttributeDefinitionSchema)
  .max(100)
  .refine((defs) => new Set(defs.map((d) => d.key)).size === defs.length, {
    message: 'Chaves de atributo repetidas',
  })

const colorField = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (#RRGGBB)')
    .nullable()
    .optional(),
)

export const CreateSdConfigItemTypeSchema = z.object({
  name: requiredText(100, 'Nome é obrigatório'),
  icon: optionalText(60),
  color: colorField,
  attributeSchema: attributeSchemaField.default([]),
  position: z.number().int().min(0).optional(),
})

export type CreateSdConfigItemTypeDTO = z.infer<
  typeof CreateSdConfigItemTypeSchema
>

export const UpdateSdConfigItemTypeSchema = z.object({
  name: requiredText(100, 'Nome é obrigatório').optional(),
  icon: optionalText(60),
  color: colorField,
  attributeSchema: attributeSchemaField.optional(),
  position: z.number().int().min(0).optional(),
})

export type UpdateSdConfigItemTypeDTO = z.infer<
  typeof UpdateSdConfigItemTypeSchema
>

/* ---------------------------- itens de config ---------------------------- */

export const SdConfigItemStatusEnum = z.enum([
  'PLANNED',
  'IN_STOCK',
  'ACTIVE',
  'MAINTENANCE',
  'RETIRED',
])

export const SdRiskLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])

const ipField = z.preprocess(
  emptyToNull,
  z
    .union([z.ipv4(), z.ipv6()], { error: 'Endereço IP inválido' })
    .nullable()
    .optional(),
)

/** Valores crus dos atributos — validados no service contra o tipo. */
const attributesField = z.record(
  z.string().max(50),
  z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]),
)

const configItemFields = {
  typeId: optionalId(),
  parentId: optionalId(),
  code: optionalText(60),
  customerId: optionalId(),
  departmentId: optionalId(),
  ownerId: optionalId(),
  serialNumber: optionalText(120),
  manufacturer: optionalText(120),
  model: optionalText(120),
  location: optionalText(200),
  ipAddress: ipField,
  purchasedAt: optionalDate(),
  warrantyUntil: optionalDate(),
  notes: optionalText(5000),
}

export const CreateSdConfigItemSchema = z.object({
  name: requiredText(200, 'Nome é obrigatório'),
  ...configItemFields,
  status: SdConfigItemStatusEnum.default('ACTIVE'),
  criticality: SdRiskLevelEnum.default('MEDIUM'),
  attributes: attributesField.default({}),
  customFields: SdCustomFieldValuesSchema.default({}),
})

export type CreateSdConfigItemDTO = z.infer<typeof CreateSdConfigItemSchema>

export const UpdateSdConfigItemSchema = z.object({
  name: requiredText(200, 'Nome é obrigatório').optional(),
  ...configItemFields,
  status: SdConfigItemStatusEnum.optional(),
  criticality: SdRiskLevelEnum.optional(),
  attributes: attributesField.optional(),
  customFields: SdCustomFieldValuesSchema.optional(),
})

export type UpdateSdConfigItemDTO = z.infer<typeof UpdateSdConfigItemSchema>

export const SdConfigItemSortEnum = z.enum([
  'name',
  'code',
  'status',
  'criticality',
  'warrantyUntil',
  'createdAt',
  'updatedAt',
])

export const ListSdConfigItemsSchema = SdPageQuerySchema.extend({
  /** Busca em nome, código, série, fabricante, modelo, local e IP. */
  q: z.string().trim().max(200).optional(),
  typeId: z.string().max(64).optional(),
  status: SdConfigItemStatusEnum.optional(),
  criticality: SdRiskLevelEnum.optional(),
  customerId: z.string().max(64).optional(),
  departmentId: z.string().max(64).optional(),
  parentId: z.string().max(64).optional(),
  /** Garantia vencendo nos próximos N dias (inclui hoje). */
  warrantyExpiringInDays: z.coerce.number().int().min(0).max(3650).optional(),
  sort: SdConfigItemSortEnum.default('name'),
})

export type ListSdConfigItemsDTO = z.infer<typeof ListSdConfigItemsSchema>

export const SdConfigItemOptionsSchema = SdOptionsQuerySchema.extend({
  customerId: z.string().max(64).optional(),
  /** Exclui o item (e nada mais) — usado no seletor de "item pai". */
  excludeId: z.string().max(64).optional(),
})

export type SdConfigItemOptionsDTO = z.infer<typeof SdConfigItemOptionsSchema>
