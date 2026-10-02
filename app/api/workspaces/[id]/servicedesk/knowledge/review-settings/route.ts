import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdKbReviewSettingsSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbReviewService } from '@/src/services/sd-kb-review.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdKbReviewService.getSettings(userId, params.id),
})

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/knowledge/review-settings',
  body: UpdateSdKbReviewSettingsSchema,
  handler: ({ userId, params, body }) =>
    SdKbReviewService.updateSettings(userId, params.id, body),
})
