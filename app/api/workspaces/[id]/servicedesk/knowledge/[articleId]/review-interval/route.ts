import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SetSdKbReviewIntervalSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbReviewService } from '@/src/services/sd-kb-review.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/knowledge/[articleId]/review-interval',
  body: SetSdKbReviewIntervalSchema,
  handler: ({ userId, params, body }) =>
    SdKbReviewService.setInterval(userId, params.id, params.articleId, body),
})
