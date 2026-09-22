import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdTicketTemplateSchema } from '@/src/schemas/sd-ticket-template.schema'
import { SdTicketTemplateService } from '@/src/services/sd-ticket-template.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/ticket-templates/[templateId]',
  body: UpdateSdTicketTemplateSchema,
  handler: ({ userId, params, body }) =>
    SdTicketTemplateService.update(userId, params.id, params.templateId, body),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/ticket-templates/[templateId]',
  handler: ({ userId, params }) =>
    SdTicketTemplateService.remove(userId, params.id, params.templateId),
})
