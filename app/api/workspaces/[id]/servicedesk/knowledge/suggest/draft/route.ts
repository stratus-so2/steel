import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SuggestSdKbForDraftSchema } from '@/src/schemas/sd-kb-review.schema'
import { SdKbTicketLinkService } from '@/src/services/sd-kb-ticket-link.service'

/**
 * Sugestões para um chamado que ainda não existe (tela de abertura e portal).
 * É POST porque o texto digitado (título + descrição) não cabe bem na query.
 */
export const POST = sdConfigRoute({
  body: SuggestSdKbForDraftSchema,
  allowEmptyBody: true,
  handler: ({ userId, params, body }) =>
    SdKbTicketLinkService.suggestForDraft(userId, params.id, body),
})
