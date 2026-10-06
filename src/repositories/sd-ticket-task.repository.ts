import type { Prisma, SdTaskStatus } from '@prisma/client'
import { sdTaskNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_TASK_INCLUDE = {
  assignee: { select: SD_USER_SUMMARY_SELECT },
  createdBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTicketTaskInclude

export type SdTicketTaskWithRelations = Prisma.SdTicketTaskGetPayload<{
  include: typeof SD_TASK_INCLUDE
}>

export interface SdTicketTaskData {
  title?: string
  description?: string | null
  status?: SdTaskStatus
  assigneeId?: string | null
  dueDate?: Date | null
  completedAt?: Date | null
  dueSoonNotifiedAt?: Date | null
  overdueNotifiedAt?: Date | null
}

/** Which due-date notice a task is waiting for. */
export type SdTaskReminderKind = 'due_soon' | 'overdue'

const REMINDER_FIELD = {
  due_soon: 'dueSoonNotifiedAt',
  overdue: 'overdueNotifiedAt',
} as const

const REMINDER_INCLUDE = {
  ticket: {
    select: {
      id: true,
      workspaceId: true,
      number: true,
      type: true,
      title: true,
      assigneeId: true,
      requesterId: true,
      departmentId: true,
      participants: { select: { userId: true } },
      contact: { select: { id: true, name: true, userId: true } },
    },
  },
} as const satisfies Prisma.SdTicketTaskInclude

export type SdTaskReminderRow = Prisma.SdTicketTaskGetPayload<{
  include: typeof REMINDER_INCLUDE
}>

/** Tarefas do chamado. Sem regra de negócio. */
export const SdTicketTaskRepository = {
  async list(ticketId: string): Promise<Result<SdTicketTaskWithRelations[]>> {
    try {
      const rows = await prisma.sdTicketTask.findMany({
        where: { ticketId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: SD_TASK_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk tasks', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTicketTaskWithRelations>> {
    try {
      const row = await prisma.sdTicketTask.findFirst({
        where: { id, ticketId },
        include: SD_TASK_INCLUDE,
      })
      if (!row) return err(sdTaskNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk task', error))
    }
  },

  /** Cria no fim da lista (`position` = maior + 1). */
  async create(
    data: SdTicketTaskData & {
      workspaceId: string
      ticketId: string
      createdById: string
      title: string
    },
  ): Promise<Result<SdTicketTaskWithRelations>> {
    try {
      const last = await prisma.sdTicketTask.aggregate({
        where: { ticketId: data.ticketId },
        _max: { position: true },
      })
      const row = await prisma.sdTicketTask.create({
        data: { ...data, position: (last._max.position ?? -1) + 1 },
        include: SD_TASK_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk task', error))
    }
  },

  async update(
    id: string,
    data: SdTicketTaskData,
  ): Promise<Result<SdTicketTaskWithRelations>> {
    try {
      const row = await prisma.sdTicketTask.update({
        where: { id },
        data,
        include: SD_TASK_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk task', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdTicketTask.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk task', error))
    }
  },

  /**
   * Open, assigned tasks of the given workspaces still owing a due-date
   * notice: due within `[now, soonUntil]` without the "soon" notice, or
   * past due since `overdueFrom` without the "overdue" one (older deadlines
   * are never announced — no flood on first run). Tickets in the trash are
   * left out.
   */
  async listDueReminders(params: {
    workspaceIds: string[]
    now: Date
    soonUntil: Date
    overdueFrom: Date
    limit: number
  }): Promise<Result<SdTaskReminderRow[]>> {
    if (params.workspaceIds.length === 0) return ok([])
    try {
      const rows = await prisma.sdTicketTask.findMany({
        where: {
          workspaceId: { in: params.workspaceIds },
          status: { in: ['TODO', 'IN_PROGRESS'] },
          assigneeId: { not: null },
          ticket: { deletedAt: null },
          OR: [
            {
              dueDate: { gt: params.now, lte: params.soonUntil },
              dueSoonNotifiedAt: null,
            },
            {
              dueDate: { gt: params.overdueFrom, lte: params.now },
              overdueNotifiedAt: null,
            },
          ],
        },
        include: REMINDER_INCLUDE,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: params.limit,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk task reminders', error))
    }
  },

  /**
   * Stamps the notice as sent if nobody did it first. `false` = another
   * tick already claimed it (so it is never sent twice).
   */
  async claimReminder(
    id: string,
    kind: SdTaskReminderKind,
    at: Date,
  ): Promise<Result<boolean>> {
    const field = REMINDER_FIELD[kind]
    try {
      const result = await prisma.sdTicketTask.updateMany({
        where: { id, [field]: null },
        data: { [field]: at },
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to claim ServiceDesk task reminder', error))
    }
  },

  /** Grava `position` = índice em `orderedIds` (só tarefas do chamado). */
  async reorder(ticketId: string, orderedIds: string[]): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdTicketTask.updateMany({
            where: { id, ticketId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder ServiceDesk tasks', error))
    }
  },
}
