import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdClassificationSchema,
  ListSdClassificationsSchema,
} from '@/src/schemas/sd-classification.schema'
import { SdClassificationService } from '@/src/services/sd-classification.service'

export const GET = sdConfigRoute({
  query: ListSdClassificationsSchema,
  handler: ({ userId, params, query }) =>
    SdClassificationService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/classifications',
  body: CreateSdClassificationSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdClassificationService.create(userId, params.id, body),
})
