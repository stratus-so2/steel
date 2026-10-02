import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { MarkSdKbResolvedSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbTicketLinkService } from '@/src/services/sd-kb-ticket-link.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/knowledge/[articleId]/resolved',
  body: MarkSdKbResolvedSchema,
  handler: ({ userId, params, body }) =>
    SdKbTicketLinkService.markResolved(
      userId,
      params.id,
      params.articleId,
      body,
    ),
})
