import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SubmitSdTicketCsatSchema } from '@/src/schemas/sd-ticket-csat.schema'
import { SdTicketCsatService } from '@/src/services/sd-ticket-csat.service'

/** Avaliação do atendimento (CSAT) pelo solicitante — uma vez, após resolver. */
export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/tickets/[ticketId]/csat',
  body: SubmitSdTicketCsatSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdTicketCsatService.submit(userId, params.id, params.ticketId, body),
})
