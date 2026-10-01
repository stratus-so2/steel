import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdMonitorSourceSchema } from '@/src/schemas/sd-monitor-source.schema'
import { SdMonitorSourceService } from '@/src/services/sd-monitor-source.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/monitor-sources/[sourceId]',
  body: UpdateSdMonitorSourceSchema,
  handler: ({ userId, params, body }) =>
    SdMonitorSourceService.update(userId, params.id, params.sourceId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/monitor-sources/[sourceId]',
  handler: ({ userId, params }) =>
    SdMonitorSourceService.remove(userId, params.id, params.sourceId),
})
