import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdCustomFieldSchema } from '@/src/schemas/sd-custom-field.schema'
import { SdCustomFieldService } from '@/src/services/sd-custom-field.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/custom-fields/[fieldId]',
  body: UpdateSdCustomFieldSchema,
  handler: ({ userId, params, body }) =>
    SdCustomFieldService.update(userId, params.id, params.fieldId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/custom-fields/[fieldId]',
  handler: ({ userId, params }) =>
    SdCustomFieldService.remove(userId, params.id, params.fieldId),
})
