import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdPartSchema,
  ListSdPartsSchema,
} from '@/src/schemas/sd-part.schema'
import { SdPartService } from '@/src/services/sd-part.service'

export const GET = sdConfigRoute({
  query: ListSdPartsSchema,
  handler: ({ userId, params, query }) =>
    SdPartService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/parts',
  body: CreateSdPartSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdPartService.create(userId, params.id, body),
})
