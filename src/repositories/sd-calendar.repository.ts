import type { Prisma, SdBusinessCalendar } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdCalendarData {
  name?: string
  timezone?: string
  schedule?: Prisma.InputJsonValue
  holidays?: Prisma.InputJsonValue
  is24x7?: boolean
  isDefault?: boolean
}

async function unsetOtherDefaults(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  keepId: string,
) {
  await tx.sdBusinessCalendar.updateMany({
    where: { workspaceId, isDefault: true, id: { not: keepId } },
    data: { isDefault: false },
  })
}

export const SdCalendarRepository = {
  async list(workspaceId: string): Promise<Result<SdBusinessCalendar[]>> {
    return sdDb('Failed to list ServiceDesk calendars', () =>
      prisma.sdBusinessCalendar.findMany({
        where: { workspaceId },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdBusinessCalendar>> {
    return sdDbFind('Failed to find ServiceDesk calendar', () =>
      prisma.sdBusinessCalendar.findFirst({ where: { id, workspaceId } }),
    )
  },

  async countDefaults(workspaceId: string): Promise<Result<number>> {
    return sdDb('Failed to count ServiceDesk default calendars', () =>
      prisma.sdBusinessCalendar.count({
        where: { workspaceId, isDefault: true },
      }),
    )
  },

  /** Cria; `isDefault` desmarca os demais na mesma transação. */
  async create(
    workspaceId: string,
    data: SdCalendarData & {
      name: string
      schedule: Prisma.InputJsonValue
    },
  ): Promise<Result<SdBusinessCalendar>> {
    return sdDb('Failed to create ServiceDesk calendar', () =>
      prisma.$transaction(async (tx) => {
        const created = await tx.sdBusinessCalendar.create({
          data: { ...data, workspaceId },
        })
        if (created.isDefault) {
          await unsetOtherDefaults(tx, workspaceId, created.id)
        }
        return created
      }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdCalendarData,
  ): Promise<Result<SdBusinessCalendar>> {
    return sdDb('Failed to update ServiceDesk calendar', () =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.sdBusinessCalendar.update({
          where: { id, workspaceId },
          data,
        })
        if (data.isDefault) await unsetOtherDefaults(tx, workspaceId, id)
        return updated
      }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk calendar', async () => {
      await prisma.sdBusinessCalendar.delete({ where: { id, workspaceId } })
    })
  },
}
