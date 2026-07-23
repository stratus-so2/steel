import type { CrmReport, Prisma } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmReportRepository = {
  async listByWorkspace(workspaceId: string): Promise<Result<CrmReport[]>> {
    try {
      const reports = await prisma.crmReport.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
      })
      return ok(reports)
    } catch (error) {
      return err(dbError('Failed to list CRM reports', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmReport>> {
    try {
      const report = await prisma.crmReport.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!report) return err(notFound('CrmReport'))
      return ok(report)
    } catch (error) {
      return err(dbError('Failed to find CRM report by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    source: string
    columns: Prisma.InputJsonValue
    filters: Prisma.InputJsonValue
    groupBy?: string
    sort?: Prisma.InputJsonValue
  }): Promise<Result<CrmReport>> {
    try {
      const position = await prisma.crmReport.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const report = await prisma.crmReport.create({
        data: { ...data, position },
      })
      return ok(report)
    } catch (error) {
      return err(dbError('Failed to create CRM report', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      columns?: Prisma.InputJsonValue
      filters?: Prisma.InputJsonValue
      groupBy?: string
      sort?: Prisma.InputJsonValue
      updatedById?: string
    },
  ): Promise<Result<CrmReport>> {
    try {
      const report = await prisma.crmReport.update({ where: { id }, data })
      return ok(report)
    } catch (error) {
      return err(dbError('Failed to update CRM report', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmReport.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM report', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmReport.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM reports', error))
    }
  },
}
