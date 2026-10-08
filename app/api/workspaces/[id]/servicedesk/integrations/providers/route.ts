import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ListSdIntegrationLinksSchema } from '@/src/schemas/sd-integration.schema'
import { SdIntegrationLinkService } from '@/src/services/sd-integration-link.service'

/** Repository providers (GitHub/GitLab) offered on the ticket screen. */
export const GET = sdConfigRoute({
  query: ListSdIntegrationLinksSchema,
  handler: ({ userId, params, query }) =>
    SdIntegrationLinkService.providers(userId, params.id, query.ticketId),
})
