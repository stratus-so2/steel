import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ListAiPendingActionsQuerySchema } from '@/src/schemas/steel-ai.schema'
import { AiPendingActionService } from '@/src/services/ai-pending-action.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { searchParams } = new URL(request.url)
  const query = ListAiPendingActionsQuerySchema.safeParse({
    status: searchParams.get('status') || undefined,
    conversationId: searchParams.get('conversationId') || undefined,
  })
  if (!query.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Parâmetros inválidos',
      query.error.issues,
    )
  }

  const { id } = await ctx.params
  const result = await AiPendingActionService.list(
    auth.value.user.id,
    id,
    query.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
