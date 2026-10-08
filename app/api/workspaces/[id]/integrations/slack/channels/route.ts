import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    WorkspaceIntegrationService.listSlackChannels(userId, params.id),
})
