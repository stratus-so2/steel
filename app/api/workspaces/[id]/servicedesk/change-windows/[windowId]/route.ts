import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdChangeWindowSchema } from '@/src/schemas/sd-change-window.schema'
import { SdChangeWindowService } from '@/src/services/sd-change-window.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/change-windows/[windowId]',
  body: UpdateSdChangeWindowSchema,
  handler: ({ userId, params, body }) =>
    SdChangeWindowService.update(userId, params.id, params.windowId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/change-windows/[windowId]',
  handler: ({ userId, params }) =>
    SdChangeWindowService.remove(userId, params.id, params.windowId),
})
