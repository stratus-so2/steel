import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateCrmDashboardSchema } from '@/src/schemas/crm-dashboard.schema'
import { CrmDashboardService } from '@/src/services/crm-dashboard.service'

/** Dashboards do ServiceDesk (motor do CRM com `module = SERVICE_DESK`). */
export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    CrmDashboardService.list(userId, params.id, 'SERVICE_DESK'),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/dashboards',
  body: CreateCrmDashboardSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    CrmDashboardService.create(userId, params.id, body, 'SERVICE_DESK'),
})
