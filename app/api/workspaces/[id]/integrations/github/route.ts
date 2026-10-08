import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  ConnectGithubSchema,
  UpdateRepoCredentialsSchema,
} from '@/src/schemas/workspace-integration.schema'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/integrations/github',
  body: ConnectGithubSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    WorkspaceIntegrationService.connectGithub(userId, params.id, body),
})

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/integrations/github',
  body: UpdateRepoCredentialsSchema,
  handler: ({ userId, params, body }) =>
    WorkspaceIntegrationService.updateRepoCredentials(
      userId,
      params.id,
      'GITHUB',
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/integrations/github',
  handler: ({ userId, params }) =>
    WorkspaceIntegrationService.disconnect(userId, params.id, 'GITHUB'),
})
