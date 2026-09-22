import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdTicketParticipantService } from '@/src/services/sd-ticket-participant.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; ticketId: string; userId: string }>
}

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/servicedesk/tickets/[ticketId]/participants/[userId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, ticketId, userId } = await ctx.params
  const result = await SdTicketParticipantService.remove(
    auth.value.user.id,
    id,
    ticketId,
    userId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
