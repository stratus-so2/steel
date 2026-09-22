import type {
  Prisma,
  SdCustomFieldDefinition,
  SdCustomFieldEntity,
  SdCustomFieldType,
  SdTicketType,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdCustomFieldData {
  label?: string
  description?: string | null
  options?: Prisma.InputJsonValue
  ticketTypes?: SdTicketType[]
  categoryIds?: string[]
  required?: boolean
  visibleInPortal?: boolean
  defaultValue?: Prisma.InputJsonValue | typeof Prisma.JsonNull
  active?: boolean
}

export const SdCustomFieldRepository = {
  async list(
    workspaceId: string,
    options: { entity?: SdCustomFieldEntity; includeInactive?: boolean } = {},
  ): Promise<Result<SdCustomFieldDefinition[]>> {
    return sdDb('Failed to list ServiceDesk custom fields', () =>
      prisma.sdCustomFieldDefinition.findMany({
        where: {
          workspaceId,
          ...(options.entity ? { entity: options.entity } : {}),
          ...(options.includeInactive ? {} : { active: true }),
        },
        orderBy: [{ entity: 'asc' }, { position: 'asc' }, { label: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdCustomFieldDefinition>> {
    return sdDbFind('Failed to find ServiceDesk custom field', () =>
      prisma.sdCustomFieldDefinition.findFirst({ where: { id, workspaceId } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdCustomFieldData & {
      entity: SdCustomFieldEntity
      key: string
      label: string
      type: SdCustomFieldType
    },
  ): Promise<Result<SdCustomFieldDefinition>> {
    return sdDb(
      'Failed to create ServiceDesk custom field',
      async () => {
        const position = await prisma.sdCustomFieldDefinition.count({
          where: { workspaceId, entity: data.entity },
        })
        return prisma.sdCustomFieldDefinition.create({
          data: { ...data, workspaceId, position },
        })
      },
      'Já existe um campo com esta chave nesta entidade',
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdCustomFieldData,
  ): Promise<Result<SdCustomFieldDefinition>> {
    return sdDb('Failed to update ServiceDesk custom field', () =>
      prisma.sdCustomFieldDefinition.update({
        where: { id, workspaceId },
        data,
      }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk custom field', async () => {
      await prisma.sdCustomFieldDefinition.delete({
        where: { id, workspaceId },
      })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk custom fields', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdCustomFieldDefinition.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },
}
