import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdRepoConfigSchema } from '@/src/schemas/sd-integration.schema'
import { SdIntegrationService } from '@/src/services/sd-integration.service'

/** ServiceDesk settings of the GitLab connection (ADR 0024). */
export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/integrations/gitlab',
  body: UpdateSdRepoConfigSchema,
  handler: ({ userId, params, body }) =>
    SdIntegrationService.updateRepoConfig(userId, params.id, 'GITLAB', body),
})
