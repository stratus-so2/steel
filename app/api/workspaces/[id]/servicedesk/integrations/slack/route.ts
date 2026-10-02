import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdSlackConfigSchema } from '@/src/schemas/sd-integration.schema'
import { SdIntegrationService } from '@/src/services/sd-integration.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/integrations/slack',
  body: UpdateSdSlackConfigSchema,
  handler: ({ userId, params, body }) =>
    SdIntegrationService.updateSlackConfig(userId, params.id, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/integrations/slack',
  handler: ({ userId, params }) =>
    SdIntegrationService.disconnect(userId, params.id, 'SLACK'),
})
