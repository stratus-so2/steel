import type {
  CrmCustomFieldDefinition,
  CrmCustomFieldValue,
} from '@prisma/client'
import type {
  CrmCustomFieldDefinitionDTO,
  CrmCustomFieldValueDTO,
} from '@/types/crm-custom-field'

export function toCrmCustomFieldDefinitionDTO(
  definition: CrmCustomFieldDefinition,
): CrmCustomFieldDefinitionDTO {
  return {
    id: definition.id,
    workspaceId: definition.workspaceId,
    entity: definition.entity,
    key: definition.key,
    label: definition.label,
    type: definition.type,
    options: definition.options,
    required: definition.required,
    position: definition.position,
    createdById: definition.createdById,
    updatedById: definition.updatedById,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  }
}

export function toCrmCustomFieldValueDTO(
  value: CrmCustomFieldValue,
): CrmCustomFieldValueDTO {
  return {
    id: value.id,
    definitionId: value.definitionId,
    recordId: value.recordId,
    value: value.value as CrmCustomFieldValueDTO['value'],
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  }
}
