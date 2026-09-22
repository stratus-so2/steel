import z from 'zod'
import { booleanQuery, sdDescription, sdId, sdName } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

export const SD_CATEGORY_LEVELS = [
  'CATEGORY',
  'SUBCATEGORY',
  'SERVICE',
] as const
export const SdCategoryLevelEnum = z.enum(SD_CATEGORY_LEVELS)
export type SdCategoryLevelValue = (typeof SD_CATEGORY_LEVELS)[number]

/**
 * Nível esperado de um nó dado o nível do pai: raiz = categoria, filho de
 * categoria = subcategoria, filho de subcategoria = serviço. Serviço não
 * tem filhos (`null`).
 */
export function expectedSdCategoryLevel(
  parentLevel: SdCategoryLevelValue | null,
): SdCategoryLevelValue | null {
  if (parentLevel === null) return 'CATEGORY'
  if (parentLevel === 'CATEGORY') return 'SUBCATEGORY'
  if (parentLevel === 'SUBCATEGORY') return 'SERVICE'
  return null
}

const ticketTypes = z
  .array(SdTicketTypeEnum)
  .max(4)
  .transform((types) => [...new Set(types)])

export const CreateSdCategorySchema = z.object({
  parentId: sdId.nullable().optional(),
  level: SdCategoryLevelEnum,
  name: sdName,
  description: sdDescription,
  icon: z.string().max(64).nullable().optional(),
  /** Tipos em que aparece (vazio = todos). */
  ticketTypes: ticketTypes.default([]),
  departmentId: sdId.nullable().optional(),
  slaPolicyId: sdId.nullable().optional(),
  portalVisible: z.boolean().default(true),
  active: z.boolean().default(true),
})
export type CreateSdCategoryDTO = z.infer<typeof CreateSdCategorySchema>

export const UpdateSdCategorySchema = z
  .object({
    parentId: sdId.nullable().optional(),
    level: SdCategoryLevelEnum.optional(),
    name: sdName.optional(),
    description: sdDescription,
    icon: z.string().max(64).nullable().optional(),
    ticketTypes: ticketTypes.optional(),
    departmentId: sdId.nullable().optional(),
    slaPolicyId: sdId.nullable().optional(),
    portalVisible: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdCategoryDTO = z.infer<typeof UpdateSdCategorySchema>

export const ListSdCategoriesSchema = z.object({
  ticketType: SdTicketTypeEnum.optional(),
  includeInactive: booleanQuery,
})
export type ListSdCategoriesDTO = z.infer<typeof ListSdCategoriesSchema>
