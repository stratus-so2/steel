import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateCrmDashboardSchema } from '@/src/schemas/crm-dashboard.schema'
import { CrmDashboardService } from '@/src/services/crm-dashboard.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/dashboards/[dashboardId]',
  body: UpdateCrmDashboardSchema,
  handler: ({ userId, params, body }) =>
    CrmDashboardService.update(
      userId,
      params.id,
      params.dashboardId,
      body,
      'SERVICE_DESK',
    ),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/dashboards/[dashboardId]',
  handler: ({ userId, params }) =>
    CrmDashboardService.remove(
      userId,
      params.id,
      params.dashboardId,
      'SERVICE_DESK',
    ),
})
