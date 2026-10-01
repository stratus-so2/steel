import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { SubmitSdTicketCsatSchema } from '@/src/schemas/sd-ticket-csat.schema'
import { SdPortalService } from '@/src/services/sd-portal.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { consumePortalWrite, portalSession } from '../../../_support'

type Params = { params: Promise<{ code: string }> }

/**
 * Avaliação do atendimento pelo contato externo (1–5 + comentário), só com
 * o chamado resolvido/fechado e uma única vez. Mesmo contrato do CSAT do
 * portal interno (`SubmitSdTicketCsatSchema`), outra porta de entrada.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const limit = await consumePortalWrite(request, session.value.contact.id)
  if (!limit.ok) return handleError(limit.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = SubmitSdTicketCsatSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { code } = await ctx.params
  const result = await SdPortalService.rate(session.value, code, parsed.data)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value, 201)
})
