import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  ConnectGitlabSchema,
  UpdateRepoCredentialsSchema,
} from '@/src/schemas/workspace-integration.schema'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/integrations/gitlab',
  body: ConnectGitlabSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    WorkspaceIntegrationService.connectGitlab(userId, params.id, body),
})

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/integrations/gitlab',
  body: UpdateRepoCredentialsSchema,
  handler: ({ userId, params, body }) =>
    WorkspaceIntegrationService.updateRepoCredentials(
      userId,
      params.id,
      'GITLAB',
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/integrations/gitlab',
  handler: ({ userId, params }) =>
    WorkspaceIntegrationService.disconnect(userId, params.id, 'GITLAB'),
})
