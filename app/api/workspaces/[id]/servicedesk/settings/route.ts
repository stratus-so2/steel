import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdSettingsSchema } from '@/src/schemas/sd-settings.schema'
import { SdSettingsService } from '@/src/services/sd-settings.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) => SdSettingsService.get(userId, params.id),
})

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/settings',
  body: UpdateSdSettingsSchema,
  handler: ({ userId, params, body }) =>
    SdSettingsService.update(userId, params.id, body),
})
