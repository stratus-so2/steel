import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdGithubIssueSchema } from '@/src/schemas/sd-integration.schema'
import { SdIntegrationLinkService } from '@/src/services/sd-integration-link.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/integrations/github/issues',
  body: CreateSdGithubIssueSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdIntegrationLinkService.createGithubIssue(userId, params.id, body),
})
