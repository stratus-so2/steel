import type { Prisma, SdPartStatus } from '@prisma/client'
import { sdPartOutOfStock, sdTicketPartNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_TICKET_PART_INCLUDE = {
  part: { select: { id: true, stock: true } },
  createdBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTicketPartInclude

export type SdTicketPartWithRelations = Prisma.SdTicketPartGetPayload<{
  include: typeof SD_TICKET_PART_INCLUDE
}>

export interface SdTicketPartData {
  name?: string
  sku?: string | null
  quantity?: number
  /** Decimal como string (`"129.90"`). */
  unitCost?: string
  serialNumber?: string | null
  status?: SdPartStatus
  notes?: string | null
}

/**
 * Ajuste de estoque da peça do catálogo feito na mesma transação: `delta`
 * negativo baixa (só se houver saldo), positivo devolve.
 */
export interface SdStockAdjustment {
  partId: string
  workspaceId: string
  delta: number
}

class OutOfStock extends Error {}

async function adjustStock(
  tx: Prisma.TransactionClient,
  stock: SdStockAdjustment | null,
): Promise<void> {
  if (!stock || stock.delta === 0) return
  const changed = await tx.sdPart.updateMany({
    where: {
      id: stock.partId,
      workspaceId: stock.workspaceId,
      stock: stock.delta < 0 ? { gte: -stock.delta } : { not: null },
    },
    data: { stock: { increment: stock.delta } },
  })
  if (changed.count === 0) throw new OutOfStock()
}

function failure(message: string, error: unknown) {
  if (error instanceof OutOfStock) return err(sdPartOutOfStock())
  return err(dbError(message, error))
}

/** Peças usadas no chamado. Sem regra de negócio (o service decide o estoque). */
export const SdTicketPartRepository = {
  async list(ticketId: string): Promise<Result<SdTicketPartWithRelations[]>> {
    try {
      const rows = await prisma.sdTicketPart.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        include: SD_TICKET_PART_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk ticket parts', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTicketPartWithRelations>> {
    try {
      const row = await prisma.sdTicketPart.findFirst({
        where: { id, ticketId },
        include: SD_TICKET_PART_INCLUDE,
      })
      if (!row) return err(sdTicketPartNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk ticket part', error))
    }
  },

  async create(
    data: SdTicketPartData & {
      workspaceId: string
      ticketId: string
      createdById: string
      partId: string | null
      name: string
    },
    stock: SdStockAdjustment | null,
  ): Promise<Result<SdTicketPartWithRelations>> {
    try {
      const row = await prisma.$transaction(async (tx) => {
        await adjustStock(tx, stock)
        return tx.sdTicketPart.create({
          data,
          include: SD_TICKET_PART_INCLUDE,
        })
      })
      return ok(row)
    } catch (error) {
      return failure('Failed to create ServiceDesk ticket part', error)
    }
  },

  async update(
    id: string,
    data: SdTicketPartData,
    stock: SdStockAdjustment | null,
  ): Promise<Result<SdTicketPartWithRelations>> {
    try {
      const row = await prisma.$transaction(async (tx) => {
        await adjustStock(tx, stock)
        return tx.sdTicketPart.update({
          where: { id },
          data,
          include: SD_TICKET_PART_INCLUDE,
        })
      })
      return ok(row)
    } catch (error) {
      return failure('Failed to update ServiceDesk ticket part', error)
    }
  },

  async delete(
    id: string,
    stock: SdStockAdjustment | null,
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(async (tx) => {
        await adjustStock(tx, stock)
        await tx.sdTicketPart.delete({ where: { id } })
      })
      return ok(undefined)
    } catch (error) {
      return failure('Failed to delete ServiceDesk ticket part', error)
    }
  },
}
