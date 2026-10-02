import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { RequestSdKbReviewSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbReviewService } from '@/src/services/sd-kb-review.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdKbReviewService.getState(userId, params.id, params.articleId),
})

export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/knowledge/[articleId]/reviews',
  body: RequestSdKbReviewSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdKbReviewService.request(userId, params.id, params.articleId, body),
})
