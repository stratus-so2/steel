import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateWorkspaceSlackSchema } from '@/src/schemas/workspace-integration.schema'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'

/** Notification rules (event → channel) and the waiting threshold. */
export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/integrations/slack',
  body: UpdateWorkspaceSlackSchema,
  handler: ({ userId, params, body }) =>
    WorkspaceIntegrationService.updateSlack(userId, params.id, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/integrations/slack',
  handler: ({ userId, params }) =>
    WorkspaceIntegrationService.disconnect(userId, params.id, 'SLACK'),
})
