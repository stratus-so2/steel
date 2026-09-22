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
}

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
