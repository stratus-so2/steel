import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdTicketChangeScheduleService } from '@/src/services/sd-ticket-change-schedule.service'

/** Agenda da mudança: janela planejada, janelas que a cobrem e conflitos. */
export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdTicketChangeScheduleService.get(userId, params.id, params.ticketId),
})
