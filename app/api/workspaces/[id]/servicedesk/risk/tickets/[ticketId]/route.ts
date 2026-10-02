import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdRiskService } from '@/src/services/sd-risk.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; ticketId: string }> }

/**
 * Previsão de risco de um chamado (id, número ou `INC-000123`) com os
 * fatores que pegaram — a nota nunca vem sem o porquê (ADR 0016).
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, ticketId } = await ctx.params
  const result = await SdRiskService.getTicketRisk(
    auth.value.user.id,
    id,
    ticketId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
