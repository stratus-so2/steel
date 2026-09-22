import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdScaleItemSchema } from '@/src/schemas/sd-priority.schema'
import { SdPriorityService } from '@/src/services/sd-priority.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/severities/[severityId]',
  body: UpdateSdScaleItemSchema,
  handler: ({ userId, params, body }) =>
    SdPriorityService.update(
      userId,
      params.id,
      'severity',
      params.severityId,
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/severities/[severityId]',
  handler: ({ userId, params }) =>
    SdPriorityService.remove(userId, params.id, 'severity', params.severityId),
})
