import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdCustomFieldService } from '@/src/services/sd-custom-field.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/custom-fields/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdCustomFieldService.reorder(userId, params.id, body.orderedIds),
})
