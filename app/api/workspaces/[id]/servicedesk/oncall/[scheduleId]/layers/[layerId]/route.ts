import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdOnCallLayerSchema } from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/oncall/[scheduleId]/layers/[layerId]',
  body: UpdateSdOnCallLayerSchema,
  handler: ({ userId, params, body }) =>
    SdOnCallService.updateLayer(
      userId,
      params.id,
      params.scheduleId,
      params.layerId,
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/oncall/[scheduleId]/layers/[layerId]',
  handler: ({ userId, params }) =>
    SdOnCallService.removeLayer(
      userId,
      params.id,
      params.scheduleId,
      params.layerId,
    ),
})
