import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdMailboxService } from '@/src/services/sd-mailbox.service'

/** Testa IMAP (e SMTP, se houver) e grava o status da caixa. */
export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/mailboxes/[mailboxId]/test',
  handler: ({ userId, params }) =>
    SdMailboxService.test(userId, params.id, params.mailboxId),
})
