import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdOnCallNowSchema } from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const GET = sdConfigRoute({
  query: SdOnCallNowSchema,
  handler: ({ userId, params, query }) =>
    SdOnCallService.now(userId, params.id, query),
})
