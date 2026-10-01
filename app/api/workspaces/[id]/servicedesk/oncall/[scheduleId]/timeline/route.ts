import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdOnCallTimelineSchema } from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const GET = sdConfigRoute({
  query: SdOnCallTimelineSchema,
  handler: ({ userId, params, query }) =>
    SdOnCallService.timeline(userId, params.id, params.scheduleId, query),
})
