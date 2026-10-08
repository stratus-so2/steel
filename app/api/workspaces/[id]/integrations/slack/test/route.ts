import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/integrations/slack/test',
  handler: ({ userId, params }) =>
    WorkspaceIntegrationService.test(userId, params.id, 'SLACK'),
})
