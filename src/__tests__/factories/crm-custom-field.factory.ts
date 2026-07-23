import { createId } from '@paralleldrive/cuid2'
import {
  type CrmCustomFieldDefinition,
  type CrmCustomFieldValue,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type {
  CrmCustomFieldDefinitionDTO,
  CrmCustomFieldValueDTO,
} from '@/types/crm-custom-field'

export function createFakeCrmCustomFieldDefinition(
  overrides?: Partial<CrmCustomFieldDefinition>,
): CrmCustomFieldDefinition {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    entity: 'COMPANY',
    key: 'segment',
    label: 'Segmento',
    type: 'TEXT',
    options: [],
    required: false,
    position: 0,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmCustomFieldDefinitionDTO(
  overrides?: Partial<CrmCustomFieldDefinitionDTO>,
): CrmCustomFieldDefinitionDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    entity: 'COMPANY',
    key: 'segment',
    label: 'Segmento',
    type: 'TEXT',
    options: [],
    required: false,
    position: 0,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmCustomFieldDefinition(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmCustomFieldDefinition,
      | 'entity'
      | 'key'
      | 'label'
      | 'type'
      | 'required'
      | 'position'
      | 'deletedAt'
    >
  >,
) {
  return prisma.crmCustomFieldDefinition.create({
    data: {
      entity: 'COMPANY',
      key: 'segment',
      label: 'Segmento',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export function createFakeCrmCustomFieldValue(
  overrides?: Partial<CrmCustomFieldValue>,
): CrmCustomFieldValue {
  const now = new Date()
  return {
    id: createId(),
    definitionId: createId(),
    recordId: createId(),
    value: 'Enterprise',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeCrmCustomFieldValueDTO(
  overrides?: Partial<CrmCustomFieldValueDTO>,
): CrmCustomFieldValueDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    definitionId: createId(),
    recordId: createId(),
    value: 'Enterprise',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmCustomFieldValue(
  definitionId: string,
  recordId: string,
  value: string | number | boolean | null = 'Enterprise',
) {
  return prisma.crmCustomFieldValue.create({
    data: {
      definitionId,
      recordId,
      value: value === null ? Prisma.JsonNull : value,
    },
  })
}
