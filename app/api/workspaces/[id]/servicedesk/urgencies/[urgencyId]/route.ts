import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdScaleItemSchema } from '@/src/schemas/sd-priority.schema'
import { SdPriorityService } from '@/src/services/sd-priority.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/urgencies/[urgencyId]',
  body: UpdateSdScaleItemSchema,
  handler: ({ userId, params, body }) =>
    SdPriorityService.update(
      userId,
      params.id,
      'urgency',
      params.urgencyId,
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/urgencies/[urgencyId]',
  handler: ({ userId, params }) =>
    SdPriorityService.remove(userId, params.id, 'urgency', params.urgencyId),
})
