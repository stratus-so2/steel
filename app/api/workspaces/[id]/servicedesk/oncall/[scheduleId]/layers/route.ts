import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdOnCallLayerSchema } from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/oncall/[scheduleId]/layers',
  body: CreateSdOnCallLayerSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdOnCallService.addLayer(userId, params.id, params.scheduleId, body),
})
