import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AiPendingActionService } from '@/src/services/ai-pending-action.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; actionId: string }> }

export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/ai/actions/[actionId]/cancel',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, actionId } = await ctx.params
  const result = await AiPendingActionService.cancel(
    auth.value.user.id,
    id,
    actionId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
