import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ListSdAgentsSchema } from '@/src/schemas/sd-config.schema'
import { SdConfigService } from '@/src/services/sd-config.service'

export const GET = sdConfigRoute({
  query: ListSdAgentsSchema,
  handler: ({ userId, params, query }) =>
    SdConfigService.agents(userId, params.id, query),
})
