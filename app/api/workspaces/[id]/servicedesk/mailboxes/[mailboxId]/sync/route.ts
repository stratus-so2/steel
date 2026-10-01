import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdMailInboundService } from '@/src/services/sd-mail-inbound.service'

/** Lê a caixa agora (sem esperar o tick de 1 min) e devolve os números. */
export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/mailboxes/[mailboxId]/sync',
  handler: ({ userId, params }) =>
    SdMailInboundService.syncNow(userId, params.id, params.mailboxId),
})
