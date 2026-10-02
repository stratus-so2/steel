import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { DecideSdKbReviewSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbReviewService } from '@/src/services/sd-kb-review.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/knowledge/reviews/[reviewId]',
  body: DecideSdKbReviewSchema,
  handler: ({ userId, params, body }) =>
    SdKbReviewService.decide(userId, params.id, params.reviewId, body),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/knowledge/reviews/[reviewId]',
  handler: ({ userId, params }) =>
    SdKbReviewService.cancel(userId, params.id, params.reviewId),
})
