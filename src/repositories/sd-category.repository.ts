import type { SdCategory, SdCategoryLevel, SdTicketType } from '@prisma/client'
import { sdCategoryNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdCategoryData {
  parentId?: string | null
  level?: SdCategoryLevel
  name?: string
  description?: string | null
  icon?: string | null
  ticketTypes?: SdTicketType[]
  departmentId?: string | null
  slaPolicyId?: string | null
  portalVisible?: boolean
  active?: boolean
}

export const SdCategoryRepository = {
  async list(
    workspaceId: string,
    options: { ticketType?: SdTicketType; includeInactive?: boolean } = {},
  ): Promise<Result<SdCategory[]>> {
    return sdDb('Failed to list ServiceDesk categories', () =>
      prisma.sdCategory.findMany({
        where: {
          workspaceId,
          ...(options.includeInactive ? {} : { active: true }),
          ...(options.ticketType
            ? {
                OR: [
                  { ticketTypes: { isEmpty: true } },
                  { ticketTypes: { has: options.ticketType } },
                ],
              }
            : {}),
        },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
    )
  },

  async findById(id: string, workspaceId: string): Promise<Result<SdCategory>> {
    return sdDbFind(
      'Failed to find ServiceDesk category',
      () => prisma.sdCategory.findFirst({ where: { id, workspaceId } }),
      sdCategoryNotFound(),
    )
  },

  async countChildren(id: string): Promise<Result<number>> {
    return sdDb('Failed to count ServiceDesk category children', () =>
      prisma.sdCategory.count({ where: { parentId: id } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdCategoryData & { name: string; level: SdCategoryLevel },
  ): Promise<Result<SdCategory>> {
    return sdDb('Failed to create ServiceDesk category', async () => {
      const position = await prisma.sdCategory.count({
        where: { workspaceId, parentId: data.parentId ?? null },
      })
      return prisma.sdCategory.create({
        data: { ...data, workspaceId, position },
      })
    })
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdCategoryData,
  ): Promise<Result<SdCategory>> {
    return sdDb('Failed to update ServiceDesk category', () =>
      prisma.sdCategory.update({ where: { id, workspaceId }, data }),
    )
  },

  /** Remove o nó e a subárvore (chamados ficam com a categoria nula). */
  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk category', async () => {
      await prisma.sdCategory.delete({ where: { id, workspaceId } })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk categories', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdCategory.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },
}
