import type { Prisma, SdCostCategory } from '@prisma/client'
import { sdCostNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_COST_INCLUDE = {
  user: { select: SD_USER_SUMMARY_SELECT },
  createdBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTicketCostInclude

export type SdTicketCostWithRelations = Prisma.SdTicketCostGetPayload<{
  include: typeof SD_COST_INCLUDE
}>

export interface SdTicketCostData {
  category?: SdCostCategory
  description?: string
  /** Decimal como string (`"1.50"`). */
  quantity?: string
  unitCost?: string
  billable?: boolean
  incurredAt?: Date
  userId?: string | null
}

/** Custos do chamado. Sem regra de negócio. */
export const SdTicketCostRepository = {
  async list(ticketId: string): Promise<Result<SdTicketCostWithRelations[]>> {
    try {
      const rows = await prisma.sdTicketCost.findMany({
        where: { ticketId },
        orderBy: [{ incurredAt: 'desc' }, { createdAt: 'desc' }],
        include: SD_COST_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk costs', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTicketCostWithRelations>> {
    try {
      const row = await prisma.sdTicketCost.findFirst({
        where: { id, ticketId },
        include: SD_COST_INCLUDE,
      })
      if (!row) return err(sdCostNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk cost', error))
    }
  },

  async create(
    data: SdTicketCostData & {
      workspaceId: string
      ticketId: string
      createdById: string
      description: string
      unitCost: string
    },
  ): Promise<Result<SdTicketCostWithRelations>> {
    try {
      const row = await prisma.sdTicketCost.create({
        data,
        include: SD_COST_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk cost', error))
    }
  },

  async update(
    id: string,
    data: SdTicketCostData,
  ): Promise<Result<SdTicketCostWithRelations>> {
    try {
      const row = await prisma.sdTicketCost.update({
        where: { id },
        data,
        include: SD_COST_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk cost', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdTicketCost.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk cost', error))
    }
  },
}
