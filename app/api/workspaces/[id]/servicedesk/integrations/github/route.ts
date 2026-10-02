import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  ConnectSdGithubSchema,
  UpdateSdGithubConfigSchema,
} from '@/src/schemas/sd-integration.schema'
import { SdIntegrationService } from '@/src/services/sd-integration.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/integrations/github',
  body: ConnectSdGithubSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdIntegrationService.connectGithub(userId, params.id, body),
})

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/integrations/github',
  body: UpdateSdGithubConfigSchema,
  handler: ({ userId, params, body }) =>
    SdIntegrationService.updateGithub(userId, params.id, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/integrations/github',
  handler: ({ userId, params }) =>
    SdIntegrationService.disconnect(userId, params.id, 'GITHUB'),
})
