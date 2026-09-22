import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdClassificationSchema } from '@/src/schemas/sd-classification.schema'
import { SdClassificationService } from '@/src/services/sd-classification.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/classifications/[classificationId]',
  body: UpdateSdClassificationSchema,
  handler: ({ userId, params, body }) =>
    SdClassificationService.update(
      userId,
      params.id,
      params.classificationId,
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/classifications/[classificationId]',
  handler: ({ userId, params }) =>
    SdClassificationService.remove(userId, params.id, params.classificationId),
})
