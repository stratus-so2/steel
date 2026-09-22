import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdClassificationService } from '@/src/services/sd-classification.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/classifications/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdClassificationService.reorder(userId, params.id, body.orderedIds),
})
