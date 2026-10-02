import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdRecurringTicketSchema } from '@/src/schemas/sd-recurring-ticket.schema'
import { SdRecurringTicketService } from '@/src/services/sd-recurring-ticket.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdRecurringTicketService.get(userId, params.id, params.recurringId),
})

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/recurring-tickets/[recurringId]',
  body: UpdateSdRecurringTicketSchema,
  handler: ({ userId, params, body }) =>
    SdRecurringTicketService.update(
      userId,
      params.id,
      params.recurringId,
      body,
    ),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/recurring-tickets/[recurringId]',
  handler: ({ userId, params }) =>
    SdRecurringTicketService.remove(userId, params.id, params.recurringId),
})
