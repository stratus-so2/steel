import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdMailboxSchema } from '@/src/schemas/sd-mailbox.schema'
import { SdMailboxService } from '@/src/services/sd-mailbox.service'

/** Caixas de e-mail do ServiceDesk (só admins do módulo). */
export const GET = sdConfigRoute({
  handler: ({ userId, params }) => SdMailboxService.list(userId, params.id),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/mailboxes',
  body: CreateSdMailboxSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdMailboxService.create(userId, params.id, body),
})
