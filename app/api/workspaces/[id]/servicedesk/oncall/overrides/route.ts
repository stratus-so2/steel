import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdOnCallOverrideSchema,
  ListSdOnCallOverridesSchema,
} from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const GET = sdConfigRoute({
  query: ListSdOnCallOverridesSchema,
  handler: ({ userId, params, query }) =>
    SdOnCallService.listOverrides(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/oncall/overrides',
  body: CreateSdOnCallOverrideSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdOnCallService.createOverride(userId, params.id, body),
})
