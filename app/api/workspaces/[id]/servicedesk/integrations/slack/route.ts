import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdSlackConfigSchema } from '@/src/schemas/sd-integration.schema'
import { SdIntegrationService } from '@/src/services/sd-integration.service'

/**
 * ServiceDesk settings of the Slack connection (team channels, ticket from a
 * message, thread mirroring). Connecting/disconnecting is workspace-level:
 * `/api/workspaces/[id]/integrations/slack` (ADR 0024).
 */
export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/integrations/slack',
  body: UpdateSdSlackConfigSchema,
  handler: ({ userId, params, body }) =>
    SdIntegrationService.updateSlackConfig(userId, params.id, body),
})
