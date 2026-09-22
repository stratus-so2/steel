import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdTicketTemplateSchema,
  ListSdTicketTemplatesSchema,
} from '@/src/schemas/sd-ticket-template.schema'
import { SdTicketTemplateService } from '@/src/services/sd-ticket-template.service'

export const GET = sdConfigRoute({
  query: ListSdTicketTemplatesSchema,
  handler: ({ userId, params, query }) =>
    SdTicketTemplateService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/ticket-templates',
  body: CreateSdTicketTemplateSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdTicketTemplateService.create(userId, params.id, body),
})
