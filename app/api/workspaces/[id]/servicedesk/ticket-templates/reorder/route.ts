import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdTicketTemplateService } from '@/src/services/sd-ticket-template.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/ticket-templates/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdTicketTemplateService.reorder(userId, params.id, body.orderedIds),
})
