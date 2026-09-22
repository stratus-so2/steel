import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdConfigService } from '@/src/services/sd-config.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) => SdConfigService.bootstrap(userId, params.id),
})
