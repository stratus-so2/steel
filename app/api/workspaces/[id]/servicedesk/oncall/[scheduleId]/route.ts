import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdOnCallScheduleSchema } from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdOnCallService.get(userId, params.id, params.scheduleId),
})

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/oncall/[scheduleId]',
  body: UpdateSdOnCallScheduleSchema,
  handler: ({ userId, params, body }) =>
    SdOnCallService.update(userId, params.id, params.scheduleId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/oncall/[scheduleId]',
  handler: ({ userId, params }) =>
    SdOnCallService.remove(userId, params.id, params.scheduleId),
})
