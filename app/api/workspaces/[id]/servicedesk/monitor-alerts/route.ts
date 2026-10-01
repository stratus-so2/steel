import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ListSdMonitorAlertsSchema } from '@/src/schemas/sd-monitor-source.schema'
import { SdMonitorSourceService } from '@/src/services/sd-monitor-source.service'

export const GET = sdConfigRoute({
  query: ListSdMonitorAlertsSchema,
  handler: ({ userId, params, query }) =>
    SdMonitorSourceService.listAlerts(userId, params.id, query),
})
