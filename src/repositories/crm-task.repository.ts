import type { CrmTask, CrmTaskStatus } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmTaskRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: {
      companyId?: string
      personId?: string
      opportunityId?: string
      status?: CrmTaskStatus
    },
  ): Promise<Result<CrmTask[]>> {
    try {
      const tasks = await prisma.crmTask.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(filters?.companyId ? { companyId: filters.companyId } : {}),
          ...(filters?.personId ? { personId: filters.personId } : {}),
          ...(filters?.opportunityId
            ? { opportunityId: filters.opportunityId }
            : {}),
          ...(filters?.status ? { status: filters.status } : {}),
        },
        orderBy: { position: 'asc' },
      })
      return ok(tasks)
    } catch (error) {
      return err(dbError('Failed to list CRM tasks', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmTask>> {
    try {
      const task = await prisma.crmTask.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!task) return err(notFound('CrmTask'))
      return ok(task)
    } catch (error) {
      return err(dbError('Failed to find CRM task by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    title: string
    status?: CrmTaskStatus
    body?: string
    dueDate?: Date
    assigneeId?: string
    companyId?: string
    personId?: string
    opportunityId?: string
  }): Promise<Result<CrmTask>> {
    try {
      const position = await prisma.crmTask.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const task = await prisma.crmTask.create({ data: { ...data, position } })
      return ok(task)
    } catch (error) {
      return err(dbError('Failed to create CRM task', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string
      status?: CrmTaskStatus
      body?: string
      dueDate?: Date
      assigneeId?: string
      updatedById?: string
    },
  ): Promise<Result<CrmTask>> {
    try {
      const task = await prisma.crmTask.update({ where: { id }, data })
      return ok(task)
    } catch (error) {
      return err(dbError('Failed to update CRM task', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmTask.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM task', error))
    }
  },
}
