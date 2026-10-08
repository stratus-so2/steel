import { prisma } from '@/src/lib/prisma'
import type {
  CompletedTaskFact,
  HandledConversationFact,
  ResolvedTicketFact,
  TimeEntryFact,
  WonOpportunityFact,
} from '@/src/lib/productivity/indicators'
import type { LocalRange } from '@/src/lib/productivity/period'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/**
 * Raw facts of the productivity panel (Ajustes › Registros de trabalho),
 * one query per source, limited to a window and optionally to one person.
 * Only data people already record while working. No business rules.
 */

async function read<T>(
  label: string,
  run: () => Promise<T>,
): Promise<Result<T>> {
  try {
    return ok(await run())
  } catch (error) {
    return err(dbError(`Failed to read ${label}`, error))
  }
}

export const ProductivityRepository = {
  /** Closed ServiceDesk time entries started in the window. */
  timeEntries(
    workspaceId: string,
    range: LocalRange,
    userId?: string,
  ): Promise<Result<TimeEntryFact[]>> {
    return read('time entries', async () => {
      const rows = await prisma.sdTimeEntry.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          endedAt: { not: null },
          startedAt: { gte: range.from, lt: range.to },
          ...(userId ? { userId } : {}),
        },
        select: {
          userId: true,
          startedAt: true,
          minutes: true,
          billable: true,
          source: true,
          amount: true,
        },
      })
      return rows.map((row) => ({
        ...row,
        amount: row.amount === null ? null : row.amount.toString(),
      }))
    })
  },

  /**
   * Tickets resolved in the window (credited to the assignee), with the
   * minutes logged on each by anyone.
   */
  resolvedTickets(
    workspaceId: string,
    range: LocalRange,
    userId?: string,
  ): Promise<Result<ResolvedTicketFact[]>> {
    return read('resolved tickets', async () => {
      const tickets = await prisma.sdTicket.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          resolvedAt: { gte: range.from, lt: range.to },
          ...(userId ? { assigneeId: userId } : {}),
        },
        select: {
          id: true,
          assigneeId: true,
          createdAt: true,
          firstRespondedAt: true,
          firstResponseDueAt: true,
          resolvedAt: true,
          resolutionDueAt: true,
          reopenCount: true,
        },
      })
      if (tickets.length === 0) return []
      const sums = await prisma.sdTimeEntry.groupBy({
        by: ['ticketId'],
        where: {
          ticketId: { in: tickets.map((t) => t.id) },
          deletedAt: null,
          endedAt: { not: null },
        },
        _sum: { minutes: true },
      })
      const minutes = new Map(
        sums.map((row) => [row.ticketId, row._sum.minutes ?? 0]),
      )
      return tickets.map(({ id, resolvedAt, ...ticket }) => ({
        ...ticket,
        resolvedAt: resolvedAt as Date,
        loggedMinutes: minutes.get(id) ?? 0,
      }))
    })
  },

  /**
   * CRM tasks marked done in the window. There is no completion timestamp:
   * the last update of a DONE task stands for it.
   */
  completedTasks(
    workspaceId: string,
    range: LocalRange,
    userId?: string,
  ): Promise<Result<CompletedTaskFact[]>> {
    return read('completed tasks', async () => {
      const rows = await prisma.crmTask.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          status: 'DONE',
          updatedAt: { gte: range.from, lt: range.to },
          ...(userId ? { assigneeId: userId } : {}),
        },
        select: { assigneeId: true, updatedAt: true },
      })
      return rows.map((row) => ({
        assigneeId: row.assigneeId,
        completedAt: row.updatedAt,
      }))
    })
  },

  /** Deals in a WON stage closed in the window (same rule as the forecast). */
  wonOpportunities(
    workspaceId: string,
    range: LocalRange,
    userId?: string,
  ): Promise<Result<WonOpportunityFact[]>> {
    return read('won opportunities', async () => {
      const rows = await prisma.crmOpportunity.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          stage: { category: 'WON' },
          closeDate: { gte: range.from, lt: range.to },
          ...(userId ? { ownerId: userId } : {}),
        },
        select: { ownerId: true, closeDate: true, amount: true },
      })
      return rows.map((row) => ({
        ownerId: row.ownerId,
        closedAt: row.closeDate as Date,
        amount: row.amount === null ? null : row.amount.toString(),
      }))
    })
  },

  /**
   * WhatsApp conversations a person replied to (human, not the AI) in the
   * window: one fact per person × conversation, at the first reply.
   */
  conversationsHandled(
    workspaceId: string,
    range: LocalRange,
    userId?: string,
  ): Promise<Result<HandledConversationFact[]>> {
    return read('handled conversations', async () => {
      const groups = await prisma.whatsAppMessage.groupBy({
        by: ['senderUserId', 'conversationId'],
        where: {
          workspaceId,
          deletedAt: null,
          direction: 'OUT',
          sentByAi: false,
          createdAt: { gte: range.from, lt: range.to },
          senderUserId: userId ?? { not: null },
        },
        _min: { createdAt: true },
      })
      return groups.map((group) => ({
        userId: group.senderUserId as string,
        at: group._min.createdAt as Date,
      }))
    })
  },
}
