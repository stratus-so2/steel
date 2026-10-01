import type { CrmDashboard, ModuleKind, Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { notFound, validationError } from '@/src/errors'
import type { PermissionAction } from '@/src/lib/permissions'
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
import { assertMember, assertModuleEnabled, assertModuleMember } from './authz'
import { SdAccess } from './sd-access'

/**
 * Autorização de ações de dashboard por módulo. CRM e Comunicação usam o
 * recurso `dashboards`; o ServiceDesk usa `sd-dashboards` e exige **agente**
 * (solicitantes do portal não veem painéis da operação).
 */
async function authorizeModule(
  actorId: string,
  workspaceId: string,
  module: ModuleKind,
  action: PermissionAction,
): Promise<Result<unknown>> {
  if (module === 'SERVICE_DESK') {
    return SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-dashboards',
      action,
    })
  }
  return assertModuleMember(actorId, workspaceId, module, {
    resource: 'dashboards',
    action,
  })
}

/**
 * Carrega um dashboard já autorizado. Com `module = SERVICE_DESK` (rotas
 * `servicedesk/dashboards/**`), autoriza pelo ServiceDesk e só aceita
 * dashboards desse módulo. Sem módulo (rotas do CRM/zap), mantém o fluxo
 * original — e nunca expõe dashboards do ServiceDesk.
 */
async function loadAuthorized(
  actorId: string,
  workspaceId: string,
  dashboardId: string,
  action: PermissionAction,
  module?: ModuleKind,
): Promise<Result<CrmDashboard>> {
  if (module === 'SERVICE_DESK') {
    const access = await authorizeModule(actorId, workspaceId, module, action)
    if (!access.ok) return access
    const dashboard = await CrmDashboardRepository.findById(
      dashboardId,
      workspaceId,
    )
    if (!dashboard.ok) return dashboard
    if (dashboard.value.module !== 'SERVICE_DESK') {
      return err(notFound('CrmDashboard'))
    }
    return dashboard
  }

  const membership = await assertMember(actorId, workspaceId, {
    resource: 'dashboards',
    action,
  })
  if (!membership.ok) return membership

  const dashboard = await CrmDashboardRepository.findById(
    dashboardId,
    workspaceId,
  )
  if (!dashboard.ok) return dashboard
  if (dashboard.value.module === 'SERVICE_DESK') {
    return err(notFound('CrmDashboard'))
  }

  const moduleEnabled = await assertModuleEnabled(
    workspaceId,
    dashboard.value.module,
  )
  if (!moduleEnabled.ok) return moduleEnabled

  return dashboard
}

const MAX_TITLE = 200

export const CrmDashboardService = {
  async list(
    actorId: string,
    workspaceId: string,
    module: ModuleKind = 'CRM',
  ): Promise<Result<CrmDashboardDTO[]>> {
    const membership = await authorizeModule(
      actorId,
      workspaceId,
      module,
      'VIEW',
    )
    if (!membership.ok) return membership

    const result = await CrmDashboardRepository.listByWorkspace(
      workspaceId,
      module,
    )
    if (!result.ok) return result

    return ok(result.value.map(toCrmDashboardDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmDashboardDTO,
    module: ModuleKind = 'CRM',
  ): Promise<Result<CrmDashboardDTO>> {
    const membership = await authorizeModule(
      actorId,
      workspaceId,
      module,
      'CREATE',
    )
    if (!membership.ok) return membership

    const result = await CrmDashboardRepository.create({
      workspaceId,
      createdById: actorId,
      title: dto.title,
      module,
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
    module?: ModuleKind,
  ): Promise<Result<CrmDashboardDTO>> {
    const existing = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'EDIT',
      module,
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
    module?: ModuleKind,
  ): Promise<Result<void>> {
    const existing = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'DELETE',
      module,
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
    module: ModuleKind = 'CRM',
  ): Promise<Result<void>> {
    const membership = await authorizeModule(
      actorId,
      workspaceId,
      module,
      'EDIT',
    )
    if (!membership.ok) return membership

    return CrmDashboardRepository.reorder(workspaceId, orderedIds)
  },

  /**
   * Cria uma cópia do dashboard (título "… (cópia)") com todos os widgets,
   * no mesmo módulo. Widget que falhar ao copiar é só logado.
   */
  async duplicate(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
    module?: ModuleKind,
  ): Promise<Result<CrmDashboardDTO>> {
    const source = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'CREATE',
      module,
    )
    if (!source.ok) return source

    const widgets =
      await CrmDashboardWidgetRepository.listByDashboard(dashboardId)
    if (!widgets.ok) return widgets

    const suffix = ' (cópia)'
    const created = await CrmDashboardRepository.create({
      workspaceId,
      createdById: actorId,
      title: `${source.value.title.slice(0, MAX_TITLE - suffix.length)}${suffix}`,
      module: source.value.module,
    })
    if (!created.ok) return created

    for (const widget of widgets.value) {
      const copy = await CrmDashboardWidgetRepository.create({
        dashboardId: created.value.id,
        type: widget.type,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        config: widget.config as Prisma.InputJsonValue,
      })
      if (!copy.ok) {
        logger.error('crm_dashboard.duplicate.widget_failed', {
          workspaceId,
          dashboardId: created.value.id,
          error: copy.error.code,
        })
      }
    }

    auditMutation({
      entity: 'crm_dashboard',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: { duplicatedFrom: dashboardId, module: source.value.module },
    })

    return ok(toCrmDashboardDTO(created.value))
  },
}

export const CrmDashboardWidgetService = {
  async list(
    actorId: string,
    workspaceId: string,
    dashboardId: string,
    module?: ModuleKind,
  ): Promise<Result<CrmDashboardWidgetDTO[]>> {
    const dashboard = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'VIEW',
      module,
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
    module?: ModuleKind,
  ): Promise<Result<CrmDashboardWidgetDTO>> {
    const dashboard = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'CREATE',
      module,
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
    module?: ModuleKind,
  ): Promise<Result<CrmDashboardWidgetDTO>> {
    const dashboard = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'EDIT',
      module,
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
    module?: ModuleKind,
  ): Promise<Result<void>> {
    const dashboard = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'DELETE',
      module,
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
    module?: ModuleKind,
  ): Promise<Result<void>> {
    const dashboard = await loadAuthorized(
      actorId,
      workspaceId,
      dashboardId,
      'EDIT',
      module,
    )
    if (!dashboard.ok) return dashboard

    return CrmDashboardWidgetRepository.applyLayout(dashboardId, dto.items)
  },
}
