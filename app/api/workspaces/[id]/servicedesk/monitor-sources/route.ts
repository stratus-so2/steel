import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdMonitorSourceSchema,
  ListSdMonitorSourcesSchema,
} from '@/src/schemas/sd-monitor-source.schema'
import { SdMonitorSourceService } from '@/src/services/sd-monitor-source.service'

export const GET = sdConfigRoute({
  query: ListSdMonitorSourcesSchema,
  handler: ({ userId, params, query }) =>
    SdMonitorSourceService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/monitor-sources',
  body: CreateSdMonitorSourceSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdMonitorSourceService.create(userId, params.id, body),
})
