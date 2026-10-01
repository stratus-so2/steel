import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdMonitorSourceService } from '@/src/services/sd-monitor-source.service'

/** Gera um token novo (o anterior para de valer). Mostrado uma única vez. */
export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/monitor-sources/[sourceId]/token',
  handler: ({ userId, params }) =>
    SdMonitorSourceService.regenerateToken(userId, params.id, params.sourceId),
})
