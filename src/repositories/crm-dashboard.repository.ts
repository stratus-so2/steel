import type {
  CrmDashboard,
  CrmDashboardWidget,
  CrmWidgetType,
  Prisma,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmDashboardRepository = {
  async listByWorkspace(workspaceId: string): Promise<Result<CrmDashboard[]>> {
    try {
      const dashboards = await prisma.crmDashboard.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
      })
      return ok(dashboards)
    } catch (error) {
      return err(dbError('Failed to list CRM dashboards', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmDashboard>> {
    try {
      const dashboard = await prisma.crmDashboard.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!dashboard) return err(notFound('CrmDashboard'))
      return ok(dashboard)
    } catch (error) {
      return err(dbError('Failed to find CRM dashboard by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    title: string
  }): Promise<Result<CrmDashboard>> {
    try {
      const position = await prisma.crmDashboard.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const dashboard = await prisma.crmDashboard.create({
        data: { ...data, position },
      })
      return ok(dashboard)
    } catch (error) {
      return err(dbError('Failed to create CRM dashboard', error))
    }
  },

  async update(
    id: string,
    data: { title?: string; updatedById?: string },
  ): Promise<Result<CrmDashboard>> {
    try {
      const dashboard = await prisma.crmDashboard.update({
        where: { id },
        data,
      })
      return ok(dashboard)
    } catch (error) {
      return err(dbError('Failed to update CRM dashboard', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmDashboard.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM dashboard', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmDashboard.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM dashboards', error))
    }
  },
}

export const CrmDashboardWidgetRepository = {
  async listByDashboard(
    dashboardId: string,
  ): Promise<Result<CrmDashboardWidget[]>> {
    try {
      const widgets = await prisma.crmDashboardWidget.findMany({
        where: { dashboardId },
      })
      return ok(widgets)
    } catch (error) {
      return err(dbError('Failed to list CRM dashboard widgets', error))
    }
  },

  async findById(
    id: string,
    dashboardId: string,
  ): Promise<Result<CrmDashboardWidget>> {
    try {
      const widget = await prisma.crmDashboardWidget.findFirst({
        where: { id, dashboardId },
      })
      if (!widget) return err(notFound('CrmDashboardWidget'))
      return ok(widget)
    } catch (error) {
      return err(dbError('Failed to find CRM dashboard widget by id', error))
    }
  },

  async create(data: {
    dashboardId: string
    type: CrmWidgetType
    x?: number
    y?: number
    w?: number
    h?: number
    config: Prisma.InputJsonValue
  }): Promise<Result<CrmDashboardWidget>> {
    try {
      const widget = await prisma.crmDashboardWidget.create({ data })
      return ok(widget)
    } catch (error) {
      return err(dbError('Failed to create CRM dashboard widget', error))
    }
  },

  async update(
    id: string,
    data: {
      x?: number
      y?: number
      w?: number
      h?: number
      config?: Prisma.InputJsonValue
    },
  ): Promise<Result<CrmDashboardWidget>> {
    try {
      const widget = await prisma.crmDashboardWidget.update({
        where: { id },
        data,
      })
      return ok(widget)
    } catch (error) {
      return err(dbError('Failed to update CRM dashboard widget', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmDashboardWidget.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM dashboard widget', error))
    }
  },
}
