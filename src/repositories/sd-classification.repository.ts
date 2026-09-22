import type {
  SdClassification,
  SdClassificationKind,
  SdTicketType,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdClassificationData {
  name?: string
  description?: string | null
  color?: string | null
  ticketTypes?: SdTicketType[]
  active?: boolean
}

export const SdClassificationRepository = {
  async list(
    workspaceId: string,
    options: { kind?: SdClassificationKind; includeInactive?: boolean } = {},
  ): Promise<Result<SdClassification[]>> {
    return sdDb('Failed to list ServiceDesk classifications', () =>
      prisma.sdClassification.findMany({
        where: {
          workspaceId,
          ...(options.kind ? { kind: options.kind } : {}),
          ...(options.includeInactive ? {} : { active: true }),
        },
        orderBy: [{ kind: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdClassification>> {
    return sdDbFind('Failed to find ServiceDesk classification', () =>
      prisma.sdClassification.findFirst({ where: { id, workspaceId } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdClassificationData & { kind: SdClassificationKind; name: string },
  ): Promise<Result<SdClassification>> {
    return sdDb('Failed to create ServiceDesk classification', async () => {
      const position = await prisma.sdClassification.count({
        where: { workspaceId, kind: data.kind },
      })
      return prisma.sdClassification.create({
        data: { ...data, workspaceId, position },
      })
    })
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdClassificationData,
  ): Promise<Result<SdClassification>> {
    return sdDb('Failed to update ServiceDesk classification', () =>
      prisma.sdClassification.update({ where: { id, workspaceId }, data }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk classification', async () => {
      await prisma.sdClassification.delete({ where: { id, workspaceId } })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk classifications', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdClassification.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },
}
