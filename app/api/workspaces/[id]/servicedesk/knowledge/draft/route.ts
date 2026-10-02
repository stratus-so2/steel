import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { DraftSdKbArticleFromTicketSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbDraftService } from '@/src/services/sd-kb-draft.service'

/** "Criar artigo a partir deste chamado" (rascunho KCS, com IA quando há). */
export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/knowledge/draft',
  body: DraftSdKbArticleFromTicketSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdKbDraftService.fromTicket(userId, params.id, body),
})
