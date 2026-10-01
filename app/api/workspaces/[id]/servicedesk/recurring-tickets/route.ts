import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdRecurringTicketSchema,
  ListSdRecurringTicketsSchema,
} from '@/src/schemas/sd-recurring-ticket.schema'
import { SdRecurringTicketService } from '@/src/services/sd-recurring-ticket.service'

export const GET = sdConfigRoute({
  query: ListSdRecurringTicketsSchema,
  handler: ({ userId, params, query }) =>
    SdRecurringTicketService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/recurring-tickets',
  body: CreateSdRecurringTicketSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdRecurringTicketService.create(userId, params.id, body),
})
