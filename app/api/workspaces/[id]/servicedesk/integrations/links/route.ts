import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  LinkSdGithubItemSchema,
  ListSdIntegrationLinksSchema,
} from '@/src/schemas/sd-integration.schema'
import { SdIntegrationLinkService } from '@/src/services/sd-integration-link.service'

export const GET = sdConfigRoute({
  query: ListSdIntegrationLinksSchema,
  handler: ({ userId, params, query }) =>
    SdIntegrationLinkService.list(userId, params.id, query.ticketId),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/integrations/links',
  body: LinkSdGithubItemSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdIntegrationLinkService.linkGithubItem(userId, params.id, body),
})
