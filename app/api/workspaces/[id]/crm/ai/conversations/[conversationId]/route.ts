import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmAiConversationService } from '@/src/services/crm-ai.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; conversationId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, conversationId } = await ctx.params

  const result = await CrmAiConversationService.listMessages(
    auth.value.user.id,
    id,
    conversationId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/crm/ai/conversations/[conversationId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, conversationId } = await ctx.params

  const result = await CrmAiConversationService.remove(
    auth.value.user.id,
    id,
    conversationId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
