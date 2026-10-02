import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SetSdOnCallParticipantsSchema } from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

/** A ordem do array é a ordem do rodízio: adiciona, remove e reordena. */
export const PUT = sdConfigRoute({
  consent:
    'PUT /api/workspaces/[id]/servicedesk/oncall/[scheduleId]/layers/[layerId]/participants',
  body: SetSdOnCallParticipantsSchema,
  handler: ({ userId, params, body }) =>
    SdOnCallService.setParticipants(
      userId,
      params.id,
      params.scheduleId,
      params.layerId,
      body,
    ),
})
