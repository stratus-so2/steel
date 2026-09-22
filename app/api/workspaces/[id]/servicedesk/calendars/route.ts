import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdCalendarSchema } from '@/src/schemas/sd-calendar.schema'
import { SdCalendarService } from '@/src/services/sd-calendar.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) => SdCalendarService.list(userId, params.id),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/calendars',
  body: CreateSdCalendarSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdCalendarService.create(userId, params.id, body),
})
