import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/oncall/overrides/[overrideId]',
  handler: ({ userId, params }) =>
    SdOnCallService.removeOverride(userId, params.id, params.overrideId),
})
