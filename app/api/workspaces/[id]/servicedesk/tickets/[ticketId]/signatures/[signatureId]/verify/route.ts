import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdTicketSignatureService } from '@/src/services/sd-ticket-signature.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; ticketId: string; signatureId: string }>
}

/** Confere a integridade: recalcula o SHA-256 do PNG e do chamado. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, ticketId, signatureId } = await ctx.params
  const result = await SdTicketSignatureService.verify(
    auth.value.user.id,
    id,
    ticketId,
    signatureId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
