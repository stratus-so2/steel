import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdRecurringTicketService } from '@/src/services/sd-recurring-ticket.service'

export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/recurring-tickets/[recurringId]/run-now',
  status: 201,
  handler: ({ userId, params }) =>
    SdRecurringTicketService.runNow(userId, params.id, params.recurringId),
})
