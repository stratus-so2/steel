import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdCustomFieldSchema,
  ListSdCustomFieldsSchema,
} from '@/src/schemas/sd-custom-field.schema'
import { SdCustomFieldService } from '@/src/services/sd-custom-field.service'

export const GET = sdConfigRoute({
  query: ListSdCustomFieldsSchema,
  handler: ({ userId, params, query }) =>
    SdCustomFieldService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/custom-fields',
  body: CreateSdCustomFieldSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdCustomFieldService.create(userId, params.id, body),
})
