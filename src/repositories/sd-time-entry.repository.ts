import type { Prisma, SdRateWindow, SdTimeEntrySource } from '@prisma/client'
import { sdTimeEntryNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_TIME_ENTRY_INCLUDE = {
  user: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTimeEntryInclude

export type SdTimeEntryWithRelations = Prisma.SdTimeEntryGetPayload<{
  include: typeof SD_TIME_ENTRY_INCLUDE
}>

export const SD_PERIOD_ENTRY_SELECT = {
  id: true,
  minutes: true,
  billable: true,
  window: true,
  startedAt: true,
  ticket: { select: { type: true, priorityId: true } },
} as const satisfies Prisma.SdTimeEntrySelect

export type SdPeriodEntryRow = Prisma.SdTimeEntryGetPayload<{
  select: typeof SD_PERIOD_ENTRY_SELECT
}>

export interface SdTimeEntryData {
  source?: SdTimeEntrySource
  startedAt?: Date
  endedAt?: Date | null
  minutes?: number
  billable?: boolean
  window?: SdRateWindow
  /** Decimal como string. */
  amount?: string | null
  description?: string | null
  contractId?: string | null
  periodId?: string | null
}

/** Apontamentos de hora do chamado. Sem regra de negócio. */
export const SdTimeEntryRepository = {
  /** Cronômetro aberto do usuário em qualquer chamado do workspace. */
  async findRunning(
    workspaceId: string,
    userId: string,
  ): Promise<Result<SdTimeEntryWithRelations | null>> {
    try {
      const row = await prisma.sdTimeEntry.findFirst({
        where: { workspaceId, userId, endedAt: null, deletedAt: null },
        orderBy: { startedAt: 'desc' },
        include: SD_TIME_ENTRY_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find running ServiceDesk timer', error))
    }
  },

  async listByTicket(
    ticketId: string,
  ): Promise<Result<SdTimeEntryWithRelations[]>> {
    try {
      const rows = await prisma.sdTimeEntry.findMany({
        where: { ticketId, deletedAt: null },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        include: SD_TIME_ENTRY_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk time entries', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTimeEntryWithRelations>> {
    try {
      const row = await prisma.sdTimeEntry.findFirst({
        where: { id, ticketId, deletedAt: null },
        include: SD_TIME_ENTRY_INCLUDE,
      })
      if (!row) return err(sdTimeEntryNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk time entry', error))
    }
  },

  /**
   * Já há apontamento do usuário naquele chamado no dia civil `[from, to)`?
   * Decide se o mínimo por chamado (`minimumMinutes`) entra.
   */
  async existsOnTicketDay(params: {
    ticketId: string
    userId: string
    from: Date
    to: Date
    excludeId?: string
  }): Promise<Result<boolean>> {
    try {
      const count = await prisma.sdTimeEntry.count({
        where: {
          ticketId: params.ticketId,
          userId: params.userId,
          deletedAt: null,
          endedAt: { not: null },
          startedAt: { gte: params.from, lt: params.to },
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        },
      })
      return ok(count > 0)
    } catch (error) {
      return err(dbError('Failed to count ServiceDesk time entries', error))
    }
  },

  async create(
    data: SdTimeEntryData & {
      workspaceId: string
      ticketId: string
      userId: string
      startedAt: Date
    },
  ): Promise<Result<SdTimeEntryWithRelations>> {
    try {
      const row = await prisma.sdTimeEntry.create({
        data,
        include: SD_TIME_ENTRY_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk time entry', error))
    }
  },

  async update(
    id: string,
    data: SdTimeEntryData,
  ): Promise<Result<SdTimeEntryWithRelations>> {
    try {
      const row = await prisma.sdTimeEntry.update({
        where: { id },
        data,
        include: SD_TIME_ENTRY_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk time entry', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdTimeEntry.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk time entry', error))
    }
  },

  /**
   * Apontamentos fechados do contrato dentro da janela do período, em ordem
   * cronológica (a franquia é consumida nessa ordem).
   */
  async listForPeriod(
    contractId: string,
    from: Date,
    to: Date,
  ): Promise<Result<SdPeriodEntryRow[]>> {
    try {
      const rows = await prisma.sdTimeEntry.findMany({
        where: {
          contractId,
          deletedAt: null,
          endedAt: { not: null },
          startedAt: { gte: from, lt: to },
        },
        orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
        select: SD_PERIOD_ENTRY_SELECT,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk time entries', error))
    }
  },

  /** Vincula os apontamentos ao período consolidado. */
  async linkPeriod(ids: string[], periodId: string): Promise<Result<number>> {
    if (ids.length === 0) return ok(0)
    try {
      const result = await prisma.sdTimeEntry.updateMany({
        where: { id: { in: ids } },
        data: { periodId },
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to link ServiceDesk time entries', error))
    }
  },
}
