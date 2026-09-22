import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdPartSchema } from '@/src/schemas/sd-part.schema'
import { SdPartService } from '@/src/services/sd-part.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/parts/[partId]',
  body: UpdateSdPartSchema,
  handler: ({ userId, params, body }) =>
    SdPartService.update(userId, params.id, params.partId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/parts/[partId]',
  handler: ({ userId, params }) =>
    SdPartService.remove(userId, params.id, params.partId),
})
