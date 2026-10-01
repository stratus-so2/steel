import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdMailboxSchema } from '@/src/schemas/sd-mailbox.schema'
import { SdMailboxService } from '@/src/services/sd-mailbox.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/mailboxes/[mailboxId]',
  body: UpdateSdMailboxSchema,
  handler: ({ userId, params, body }) =>
    SdMailboxService.update(userId, params.id, params.mailboxId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/mailboxes/[mailboxId]',
  handler: ({ userId, params }) =>
    SdMailboxService.remove(userId, params.id, params.mailboxId),
})
