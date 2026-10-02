import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdIntegrationLinkService } from '@/src/services/sd-integration-link.service'

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/integrations/links/[linkId]',
  handler: ({ userId, params }) =>
    SdIntegrationLinkService.remove(userId, params.id, params.linkId),
})
