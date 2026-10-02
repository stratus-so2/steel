import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ListSdRecurringTicketRunsSchema } from '@/src/schemas/sd-recurring-ticket.schema'
import { SdRecurringTicketService } from '@/src/services/sd-recurring-ticket.service'

export const GET = sdConfigRoute({
  query: ListSdRecurringTicketRunsSchema,
  handler: ({ userId, params, query }) =>
    SdRecurringTicketService.runs(
      userId,
      params.id,
      params.recurringId,
      query.limit,
    ),
})
