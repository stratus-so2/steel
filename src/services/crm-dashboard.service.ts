import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmDashboardDTO,
  toCrmDashboardWidgetDTO,
} from '@/src/mappers/crm-dashboard.mapper'
import {
  CrmDashboardRepository,
  CrmDashboardWidgetRepository,
} from '@/src/repositories/crm-dashboard.repository'
import type {
  CreateCrmDashboardDTO,
  CreateCrmDashboardWidgetDTO,
  CrmDashboardWidgetLayoutBatchDTO,
  UpdateCrmDashboardDTO,
  UpdateCrmDashboardWidgetDTO,
} from '@/src/schemas/crm-dashboard.schema'
import { widgetConfigSchema } from '@/src/schemas/crm-dashboard.schema'
import type {
  CrmDashboardDTO,
  CrmDashboardWidgetDTO,
} from '@/types/crm-dashboard'
import { assertMember } from './authz'

export const CrmDashboardService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmDashboardDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmDashboardRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmDashboardDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmDashboardDTO,
  ): Promise<Result<CrmDashboardDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmDashboardRepository.create({
      workspaceId,
      createdById: actorId,
      title: dto.title,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_dashboard',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_dashboard',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmDashboardDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
    dto: UpdateCrmDashboardDTO,
  ): Promise<Result<CrmDashboardDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmDashboardRepository.update(dashboardId, {
      title: dto.title,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_dashboard',
      action: 'update',
      actorId,
      targetId: dashboardId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmDashboardDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmDashboardRepository.softDelete(dashboardId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_dashboard',
      action: 'delete',
      actorId,
      targetId: dashboardId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmDashboardRepository.reorder(workspaceId, orderedIds)
  },
}

export const CrmDashboardWidgetService = {
  async list(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
  ): Promise<Result<CrmDashboardWidgetDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const dashboard = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!dashboard.ok) return dashboard

    const result =
      await CrmDashboardWidgetRepository.listByDashboard(dashboardId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmDashboardWidgetDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
    dto: CreateCrmDashboardWidgetDTO,
  ): Promise<Result<CrmDashboardWidgetDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const dashboard = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!dashboard.ok) return dashboard

    const result = await CrmDashboardWidgetRepository.create({
      dashboardId,
      type: dto.type,
      x: dto.x,
      y: dto.y,
      w: dto.w,
      h: dto.h,
      config: dto.config as Prisma.InputJsonValue,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_dashboard_widget',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_dashboard_widget',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmDashboardWidgetDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
    widgetId: string,
    dto: UpdateCrmDashboardWidgetDTO,
  ): Promise<Result<CrmDashboardWidgetDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const dashboard = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!dashboard.ok) return dashboard

    const existing = await CrmDashboardWidgetRepository.findById(
      widgetId,
      dashboardId,
    )
    if (!existing.ok) return existing

    let config: Prisma.InputJsonValue | undefined
    if (dto.config !== undefined) {
      const parsed = widgetConfigSchema(existing.value.type).safeParse(
        dto.config,
      )
      if (!parsed.success) {
        return err(validationError('Config inválida para este tipo de widget'))
      }
      config = parsed.data as Prisma.InputJsonValue
    }

    const result = await CrmDashboardWidgetRepository.update(widgetId, {
      x: dto.x,
      y: dto.y,
      w: dto.w,
      h: dto.h,
      config,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_dashboard_widget',
      action: 'update',
      actorId,
      targetId: widgetId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmDashboardWidgetDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
    widgetId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const dashboard = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!dashboard.ok) return dashboard

    const existing = await CrmDashboardWidgetRepository.findById(
      widgetId,
      dashboardId,
    )
    if (!existing.ok) return existing

    const result = await CrmDashboardWidgetRepository.delete(widgetId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_dashboard_widget',
      action: 'delete',
      actorId,
      targetId: widgetId,
    })

    return ok(undefined)
  },

  /** Aplica posições/tamanhos em lote (drag/resize do grid). */
  async applyLayout(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
    dto: CrmDashboardWidgetLayoutBatchDTO,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const dashboard = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!dashboard.ok) return dashboard

    return CrmDashboardWidgetRepository.applyLayout(dashboardId, dto.items)
  },
}
