import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdScaleItemSchema } from '@/src/schemas/sd-priority.schema'
import { SdPriorityService } from '@/src/services/sd-priority.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/priorities/[priorityId]',
  body: UpdateSdScaleItemSchema,
  handler: ({ userId, params, body }) =>
    SdPriorityService.update(
      userId,
      params.id,
      'priority',
      params.priorityId,
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/priorities/[priorityId]',
  handler: ({ userId, params }) =>
    SdPriorityService.remove(userId, params.id, 'priority', params.priorityId),
})
