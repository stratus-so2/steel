import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ListSdKbReviewsSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbReviewService } from '@/src/services/sd-kb-review.service'

export const GET = sdConfigRoute({
  query: ListSdKbReviewsSchema,
  handler: ({ userId, params, query }) =>
    SdKbReviewService.list(userId, params.id, query),
})
