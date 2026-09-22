import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SaveSdPriorityMatrixSchema } from '@/src/schemas/sd-priority.schema'
import { SdPriorityService } from '@/src/services/sd-priority.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdPriorityService.getMatrix(userId, params.id),
})

export const PUT = sdConfigRoute({
  consent: 'PUT /api/workspaces/[id]/servicedesk/priority-matrix',
  body: SaveSdPriorityMatrixSchema,
  handler: ({ userId, params, body }) =>
    SdPriorityService.saveMatrix(userId, params.id, body),
})
