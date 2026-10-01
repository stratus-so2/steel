import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdAiService } from '@/src/services/sd-ai.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; ticketId: string }> }

/** Copiloto: rascunho do campo "Solução" do chamado. */
export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/ai/tickets/[ticketId]/solution',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, ticketId } = await ctx.params
  const result = await SdAiService.draftSolution(
    auth.value.user.id,
    id,
    ticketId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
