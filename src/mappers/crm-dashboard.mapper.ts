import type { CrmDashboard, CrmDashboardWidget } from '@prisma/client'
import type {
  CrmDashboardDTO,
  CrmDashboardWidgetDTO,
} from '@/types/crm-dashboard'

export function toCrmDashboardDTO(dashboard: CrmDashboard): CrmDashboardDTO {
  return {
    id: dashboard.id,
    title: dashboard.title,
    workspaceId: dashboard.workspaceId,
    module: dashboard.module,
    createdById: dashboard.createdById,
    updatedById: dashboard.updatedById,
    position: dashboard.position,
    createdAt: dashboard.createdAt.toISOString(),
    updatedAt: dashboard.updatedAt.toISOString(),
  }
}

export function toCrmDashboardWidgetDTO(
  widget: CrmDashboardWidget,
): CrmDashboardWidgetDTO {
  return {
    id: widget.id,
    dashboardId: widget.dashboardId,
    type: widget.type,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    config: widget.config as Record<string, unknown>,
    createdAt: widget.createdAt.toISOString(),
    updatedAt: widget.updatedAt.toISOString(),
  }
}
