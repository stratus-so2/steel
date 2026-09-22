import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdSeedService } from '@/src/services/sd-seed.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/settings/restore-defaults',
  handler: ({ userId, params }) =>
    SdSeedService.restoreDefaults(userId, params.id),
})
