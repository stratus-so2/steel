import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdKbStatsSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbReviewService } from '@/src/services/sd-kb-review.service'

export const GET = sdConfigRoute({
  query: SdKbStatsSchema,
  handler: ({ userId, params, query }) =>
    SdKbReviewService.stats(userId, params.id, query),
})
