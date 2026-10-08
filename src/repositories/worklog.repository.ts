import type {
  Prisma,
  SdBusinessCalendar,
  SdTicketType,
  SdTimeEntrySource,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { sdMoney, sdSum } from '@/src/lib/servicedesk/money'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

/**
 * Ajustes › Registros de trabalho: the closed ServiceDesk time entries of a
 * workspace, plus the context the screen needs (members, business
 * calendar, ticket prefixes). No business rules.
 */

export const WORKLOG_ENTRY_SELECT = {
  id: true,
  startedAt: true,
  endedAt: true,
  minutes: true,
  billable: true,
  source: true,
  amount: true,
  description: true,
  user: { select: SD_USER_SUMMARY_SELECT },
  ticket: { select: { id: true, number: true, type: true, title: true } },
} as const satisfies Prisma.SdTimeEntrySelect

export type WorklogEntryRow = Prisma.SdTimeEntryGetPayload<{
  select: typeof WORKLOG_ENTRY_SELECT
}>

export interface WorklogWhere {
  workspaceId: string
  from: Date
  to: Date
  userId?: string
  ticket?: { number: number; type: SdTicketType | null }
  billable?: boolean
  source?: SdTimeEntrySource
}

export interface WorklogTotalsRow {
  entries: number
  minutes: number
  billableMinutes: number
  timerMinutes: number
  /** Decimal as string. */
  amount: string
}

export interface WorklogMemberRow {
  id: string
  name: string
  email: string
  image: string | null
}

export function worklogWhere(w: WorklogWhere): Prisma.SdTimeEntryWhereInput {
  return {
    workspaceId: w.workspaceId,
    deletedAt: null,
    endedAt: { not: null },
    startedAt: { gte: w.from, lt: w.to },
    ...(w.userId ? { userId: w.userId } : {}),
    ...(w.billable !== undefined ? { billable: w.billable } : {}),
    ...(w.source ? { source: w.source } : {}),
    ...(w.ticket
      ? {
          ticket: {
            number: w.ticket.number,
            ...(w.ticket.type ? { type: w.ticket.type } : {}),
          },
        }
      : {}),
  }
}

const ORDER = [
  { startedAt: 'desc' },
  { id: 'desc' },
] as const satisfies Prisma.SdTimeEntryOrderByWithRelationInput[]

export const WorklogRepository = {
  async listPage(
    w: WorklogWhere,
    page: { skip: number; take: number },
  ): Promise<Result<{ rows: WorklogEntryRow[]; total: number }>> {
    try {
      const where = worklogWhere(w)
      const [rows, total] = await Promise.all([
        prisma.sdTimeEntry.findMany({
          where,
          orderBy: [...ORDER],
          skip: page.skip,
          take: page.take,
          select: WORKLOG_ENTRY_SELECT,
        }),
        prisma.sdTimeEntry.count({ where }),
      ])
      return ok({ rows, total })
    } catch (error) {
      return err(dbError('Failed to list work log entries', error))
    }
  },

  /** One batch of the CSV export, newest first, keyset by id. */
  async listBatch(
    w: WorklogWhere,
    take: number,
    afterId?: string,
  ): Promise<Result<WorklogEntryRow[]>> {
    try {
      const rows = await prisma.sdTimeEntry.findMany({
        where: worklogWhere(w),
        orderBy: [...ORDER],
        take,
        ...(afterId ? { skip: 1, cursor: { id: afterId } } : {}),
        select: WORKLOG_ENTRY_SELECT,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list work log entries', error))
    }
  },

  async totals(w: WorklogWhere): Promise<Result<WorklogTotalsRow>> {
    try {
      const groups = await prisma.sdTimeEntry.groupBy({
        by: ['billable', 'source'],
        where: worklogWhere(w),
        _sum: { minutes: true, amount: true },
        _count: { _all: true },
      })
      let entries = 0
      let minutes = 0
      let billableMinutes = 0
      let timerMinutes = 0
      const amounts: string[] = []
      for (const group of groups) {
        const sum = Number(group._sum.minutes)
        entries += group._count._all
        minutes += sum
        if (group.billable) billableMinutes += sum
        if (group.source === 'TIMER') timerMinutes += sum
        if (group._sum.amount !== null)
          amounts.push(group._sum.amount.toString())
      }
      return ok({
        entries,
        minutes,
        billableMinutes,
        timerMinutes,
        amount: sdMoney(sdSum(amounts)),
      })
    } catch (error) {
      return err(dbError('Failed to total work log entries', error))
    }
  },

  async members(workspaceId: string): Promise<Result<WorklogMemberRow[]>> {
    try {
      const rows = await prisma.membership.findMany({
        where: { workspaceId },
        select: { user: { select: SD_USER_SUMMARY_SELECT } },
      })
      return ok(
        rows
          .map((row) => row.user)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      )
    } catch (error) {
      return err(dbError('Failed to list workspace members', error))
    }
  },

  async defaultCalendar(
    workspaceId: string,
  ): Promise<Result<SdBusinessCalendar | null>> {
    try {
      const row =
        (await prisma.sdBusinessCalendar.findFirst({
          where: { workspaceId, isDefault: true },
        })) ??
        (await prisma.sdBusinessCalendar.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: 'asc' },
        }))
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find the business calendar', error))
    }
  },

  async ticketPrefixes(workspaceId: string): Promise<Result<unknown>> {
    try {
      const row = await prisma.sdSettings.findUnique({
        where: { workspaceId },
        select: { ticketPrefixes: true },
      })
      return ok(row?.ticketPrefixes ?? null)
    } catch (error) {
      return err(dbError('Failed to read ServiceDesk settings', error))
    }
  },
}
