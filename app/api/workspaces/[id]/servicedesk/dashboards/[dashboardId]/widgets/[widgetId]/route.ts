import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateCrmDashboardWidgetSchema } from '@/src/schemas/crm-dashboard.schema'
import { CrmDashboardWidgetService } from '@/src/services/crm-dashboard.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/dashboards/[dashboardId]/widgets/[widgetId]',
  body: UpdateCrmDashboardWidgetSchema,
  handler: ({ userId, params, body }) =>
    CrmDashboardWidgetService.update(
      userId,
      params.id,
      params.dashboardId,
      params.widgetId,
      body,
      'SERVICE_DESK',
    ),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/dashboards/[dashboardId]/widgets/[widgetId]',
  handler: ({ userId, params }) =>
    CrmDashboardWidgetService.remove(
      userId,
      params.id,
      params.dashboardId,
      params.widgetId,
      'SERVICE_DESK',
    ),
})
