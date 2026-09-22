import z from 'zod'
import { booleanQuery, sdColor, sdDescription, sdId } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

export const SD_CUSTOM_FIELD_ENTITIES = [
  'TICKET',
  'CUSTOMER',
  'CONTACT',
  'CONFIG_ITEM',
] as const
export const SdCustomFieldEntityEnum = z.enum(SD_CUSTOM_FIELD_ENTITIES)

export const SD_CUSTOM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'DATETIME',
  'CHECKBOX',
  'SELECT',
  'MULTI_SELECT',
  'USER',
  'EMAIL',
  'URL',
  'PHONE',
] as const
export const SdCustomFieldTypeEnum = z.enum(SD_CUSTOM_FIELD_TYPES)

export const SD_CUSTOM_FIELD_KEY = /^[a-zA-Z][a-zA-Z0-9_]*$/

export const SdCustomFieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(120),
  color: sdColor,
})

const options = z
  .array(SdCustomFieldOptionSchema)
  .max(200)
  .refine((list) => new Set(list.map((o) => o.value)).size === list.length, {
    message: 'Há opções com o mesmo valor',
  })

const ticketTypes = z
  .array(SdTicketTypeEnum)
  .max(4)
  .transform((types) => [...new Set(types)])

const categoryIds = z
  .array(sdId)
  .max(200)
  .transform((ids) => [...new Set(ids)])

/** Valor JSON do padrão (validado contra o tipo no service). */
const defaultValue = z
  .union([
    z.string().max(10_000),
    z.number(),
    z.boolean(),
    z.array(z.string().max(100)).max(200),
  ])
  .nullable()
  .optional()

const label = z.string().trim().min(1, 'Rótulo é obrigatório').max(120)

const needsOptions = (type: string) =>
  type === 'SELECT' || type === 'MULTI_SELECT'

export const CreateSdCustomFieldSchema = z
  .object({
    entity: SdCustomFieldEntityEnum,
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(
        SD_CUSTOM_FIELD_KEY,
        'Chave: comece com letra e use letras, números ou _',
      ),
    label,
    description: sdDescription,
    type: SdCustomFieldTypeEnum,
    options: options.default([]),
    /** Só TICKET: tipos em que aparece (vazio = todos). */
    ticketTypes: ticketTypes.default([]),
    /** Só TICKET: categorias em que aparece (vazio = todas). */
    categoryIds: categoryIds.default([]),
    required: z.boolean().default(false),
    visibleInPortal: z.boolean().default(false),
    defaultValue,
    active: z.boolean().default(true),
  })
  .refine((f) => !needsOptions(f.type) || f.options.length > 0, {
    message: 'Campos de seleção precisam de ao menos uma opção',
    path: ['options'],
  })
export type CreateSdCustomFieldDTO = z.infer<typeof CreateSdCustomFieldSchema>

/** `entity`, `key` e `type` são imutáveis (valores já gravados dependem deles). */
export const UpdateSdCustomFieldSchema = z
  .object({
    label: label.optional(),
    description: sdDescription,
    options: options.optional(),
    ticketTypes: ticketTypes.optional(),
    categoryIds: categoryIds.optional(),
    required: z.boolean().optional(),
    visibleInPortal: z.boolean().optional(),
    defaultValue,
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdCustomFieldDTO = z.infer<typeof UpdateSdCustomFieldSchema>

export const ListSdCustomFieldsSchema = z.object({
  entity: SdCustomFieldEntityEnum.optional(),
  includeInactive: booleanQuery,
})
export type ListSdCustomFieldsDTO = z.infer<typeof ListSdCustomFieldsSchema>
