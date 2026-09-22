import type { SdPart } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdPartData {
  name?: string
  sku?: string | null
  description?: string | null
  /** Decimal como string (`"129.90"`). */
  unitCost?: string
  stock?: number | null
  active?: boolean
}

export const SdPartRepository = {
  async list(
    workspaceId: string,
    options: { q?: string; includeInactive?: boolean } = {},
  ): Promise<Result<SdPart[]>> {
    const contains = options.q
      ? { contains: options.q, mode: 'insensitive' as const }
      : undefined
    return sdDb('Failed to list ServiceDesk parts', () =>
      prisma.sdPart.findMany({
        where: {
          workspaceId,
          ...(options.includeInactive ? {} : { active: true }),
          ...(contains ? { OR: [{ name: contains }, { sku: contains }] } : {}),
        },
        orderBy: { name: 'asc' },
      }),
    )
  },

  async findById(id: string, workspaceId: string): Promise<Result<SdPart>> {
    return sdDbFind('Failed to find ServiceDesk part', () =>
      prisma.sdPart.findFirst({ where: { id, workspaceId } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdPartData & { name: string },
  ): Promise<Result<SdPart>> {
    return sdDb('Failed to create ServiceDesk part', () =>
      prisma.sdPart.create({ data: { ...data, workspaceId } }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdPartData,
  ): Promise<Result<SdPart>> {
    return sdDb('Failed to update ServiceDesk part', () =>
      prisma.sdPart.update({ where: { id, workspaceId }, data }),
    )
  },

  /** Remove do catálogo (peças já lançadas em chamados ficam, sem vínculo). */
  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk part', async () => {
      await prisma.sdPart.delete({ where: { id, workspaceId } })
    })
  },
}
