import type { SdCustomFieldDefinition } from '@prisma/client'
import z from 'zod'
import { SdCustomFieldOptionSchema } from '@/src/schemas/sd-custom-field.schema'
import type {
  SdCustomFieldDefinitionDTO,
  SdCustomFieldOptionDTO,
} from '@/types/sd-config'

/** JSON salvo → opções válidas (itens inválidos são descartados). */
export function toSdCustomFieldOptions(
  value: unknown,
): SdCustomFieldOptionDTO[] {
  const parsed = z.array(z.unknown()).safeParse(value)
  if (!parsed.success) return []
  return parsed.data.flatMap((item) => {
    const option = SdCustomFieldOptionSchema.safeParse(item)
    return option.success ? [option.data] : []
  })
}

export function toSdCustomFieldDTO(
  field: SdCustomFieldDefinition,
): SdCustomFieldDefinitionDTO {
  return {
    id: field.id,
    entity: field.entity,
    key: field.key,
    label: field.label,
    description: field.description,
    type: field.type,
    options: toSdCustomFieldOptions(field.options),
    ticketTypes: field.ticketTypes,
    categoryIds: field.categoryIds,
    required: field.required,
    visibleInPortal: field.visibleInPortal,
    defaultValue: field.defaultValue ?? null,
    active: field.active,
    position: field.position,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  }
}
