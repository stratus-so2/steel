import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdScaleItemSchema } from '@/src/schemas/sd-priority.schema'
import { SdPriorityService } from '@/src/services/sd-priority.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdPriorityService.list(userId, params.id, 'impact'),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/impacts',
  body: CreateSdScaleItemSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdPriorityService.create(userId, params.id, 'impact', body),
})
