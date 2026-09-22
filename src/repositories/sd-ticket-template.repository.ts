import type { Prisma, SdTicketTemplate, SdTicketType } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdTicketTemplateData {
  name?: string
  description?: string | null
  defaults?: Prisma.InputJsonValue
  tasks?: Prisma.InputJsonValue
  portalVisible?: boolean
  active?: boolean
}

export const SdTicketTemplateRepository = {
  async list(
    workspaceId: string,
    options: { ticketType?: SdTicketType; includeInactive?: boolean } = {},
  ): Promise<Result<SdTicketTemplate[]>> {
    return sdDb('Failed to list ServiceDesk ticket templates', () =>
      prisma.sdTicketTemplate.findMany({
        where: {
          workspaceId,
          ...(options.ticketType ? { ticketType: options.ticketType } : {}),
          ...(options.includeInactive ? {} : { active: true }),
        },
        orderBy: [{ ticketType: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdTicketTemplate>> {
    return sdDbFind('Failed to find ServiceDesk ticket template', () =>
      prisma.sdTicketTemplate.findFirst({ where: { id, workspaceId } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdTicketTemplateData & { ticketType: SdTicketType; name: string },
  ): Promise<Result<SdTicketTemplate>> {
    return sdDb('Failed to create ServiceDesk ticket template', async () => {
      const position = await prisma.sdTicketTemplate.count({
        where: { workspaceId, ticketType: data.ticketType },
      })
      return prisma.sdTicketTemplate.create({
        data: { ...data, workspaceId, position },
      })
    })
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdTicketTemplateData,
  ): Promise<Result<SdTicketTemplate>> {
    return sdDb('Failed to update ServiceDesk ticket template', () =>
      prisma.sdTicketTemplate.update({ where: { id, workspaceId }, data }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk ticket template', async () => {
      await prisma.sdTicketTemplate.delete({ where: { id, workspaceId } })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk ticket templates', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdTicketTemplate.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },
}
