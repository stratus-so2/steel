import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CrmDashboardService } from '@/src/services/crm-dashboard.service'

export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/dashboards/[dashboardId]/duplicate',
  status: 201,
  handler: ({ userId, params }) =>
    CrmDashboardService.duplicate(
      userId,
      params.id,
      params.dashboardId,
      'SERVICE_DESK',
    ),
})
