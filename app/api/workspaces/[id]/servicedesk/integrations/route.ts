import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdIntegrationService } from '@/src/services/sd-integration.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdIntegrationService.overview(userId, params.id),
})
