import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdCalendarSchema } from '@/src/schemas/sd-calendar.schema'
import { SdCalendarService } from '@/src/services/sd-calendar.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/calendars/[calendarId]',
  body: UpdateSdCalendarSchema,
  handler: ({ userId, params, body }) =>
    SdCalendarService.update(userId, params.id, params.calendarId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/calendars/[calendarId]',
  handler: ({ userId, params }) =>
    SdCalendarService.remove(userId, params.id, params.calendarId),
})
