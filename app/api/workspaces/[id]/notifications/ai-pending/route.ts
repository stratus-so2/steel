import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { InboxAiPendingService } from '@/src/services/inbox-ai-pending.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/**
 * "Pendências da IA" of the inbox: the caller's pending assistant actions
 * and the Steel Agent approvals the caller may decide. Decisions go through
 * `/ai/actions/{id}/confirm|cancel` and
 * `/agents/runs/{runId}/actions/{id}/approve|reject`.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const result = await InboxAiPendingService.list(auth.value.user.id, id)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
