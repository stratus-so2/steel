import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CrmDashboardWidgetLayoutBatchSchema } from '@/src/schemas/crm-dashboard.schema'
import { CrmDashboardWidgetService } from '@/src/services/crm-dashboard.service'

export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/dashboards/[dashboardId]/widgets/layout',
  body: CrmDashboardWidgetLayoutBatchSchema,
  handler: ({ userId, params, body }) =>
    CrmDashboardWidgetService.applyLayout(
      userId,
      params.id,
      params.dashboardId,
      body,
      'SERVICE_DESK',
    ),
})
