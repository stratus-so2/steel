import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdCannedResponseSchema,
  ListSdCannedResponsesSchema,
} from '@/src/schemas/sd-canned-response.schema'
import { SdCannedResponseService } from '@/src/services/sd-canned-response.service'

export const GET = sdConfigRoute({
  query: ListSdCannedResponsesSchema,
  handler: ({ userId, params, query }) =>
    SdCannedResponseService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/canned-responses',
  body: CreateSdCannedResponseSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdCannedResponseService.create(userId, params.id, body),
})
