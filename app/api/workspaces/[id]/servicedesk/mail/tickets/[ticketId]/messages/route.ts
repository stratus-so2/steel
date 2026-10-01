import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdMailboxService } from '@/src/services/sd-mailbox.service'

/**
 * E-mails de um chamado (`ticketId` aceita id, número ou `INC-000123`): o
 * histórico usa para marcar as mensagens que vieram ou saíram por e-mail.
 */
export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdMailboxService.listTicketMail(userId, params.id, params.ticketId),
})
