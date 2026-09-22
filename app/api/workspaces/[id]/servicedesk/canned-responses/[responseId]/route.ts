import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdCannedResponseSchema } from '@/src/schemas/sd-canned-response.schema'
import { SdCannedResponseService } from '@/src/services/sd-canned-response.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/canned-responses/[responseId]',
  body: UpdateSdCannedResponseSchema,
  handler: ({ userId, params, body }) =>
    SdCannedResponseService.update(userId, params.id, params.responseId, body),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/canned-responses/[responseId]',
  handler: ({ userId, params }) =>
    SdCannedResponseService.remove(userId, params.id, params.responseId),
})
