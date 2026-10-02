import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdOnCallScheduleSchema,
  ListSdOnCallSchedulesSchema,
} from '@/src/schemas/sd-oncall.schema'
import { SdOnCallService } from '@/src/services/sd-oncall.service'

export const GET = sdConfigRoute({
  query: ListSdOnCallSchedulesSchema,
  handler: ({ userId, params, query }) =>
    SdOnCallService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/oncall',
  body: CreateSdOnCallScheduleSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdOnCallService.create(userId, params.id, body),
})
