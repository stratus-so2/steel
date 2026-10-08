import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdRepoConfigSchema } from '@/src/schemas/sd-integration.schema'
import { SdIntegrationService } from '@/src/services/sd-integration.service'

/**
 * ServiceDesk settings of the GitHub connection. Connecting, rotating the
 * token and disconnecting are workspace-level:
 * `/api/workspaces/[id]/integrations/github` (ADR 0024).
 */
export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/integrations/github',
  body: UpdateSdRepoConfigSchema,
  handler: ({ userId, params, body }) =>
    SdIntegrationService.updateRepoConfig(userId, params.id, 'GITHUB', body),
})
