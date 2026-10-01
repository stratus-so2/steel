import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateCrmDashboardWidgetSchema } from '@/src/schemas/crm-dashboard.schema'
import { CrmDashboardWidgetService } from '@/src/services/crm-dashboard.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    CrmDashboardWidgetService.list(
      userId,
      params.id,
      params.dashboardId,
      'SERVICE_DESK',
    ),
})

export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/dashboards/[dashboardId]/widgets',
  body: CreateCrmDashboardWidgetSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    CrmDashboardWidgetService.create(
      userId,
      params.id,
      params.dashboardId,
      body,
      'SERVICE_DESK',
    ),
})
