import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ListSteelAgentRunsQuerySchema } from '@/src/schemas/steel-agent.schema'
import { SteelAgentService } from '@/src/services/steel-agent.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; agentId: string }> }

export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { searchParams } = new URL(request.url)
  const query = ListSteelAgentRunsQuerySchema.safeParse({
    limit: searchParams.get('limit') || undefined,
    status: searchParams.get('status') || undefined,
  })
  if (!query.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Parâmetros inválidos',
      query.error.issues,
    )
  }

  const { id, agentId } = await ctx.params
  const result = await SteelAgentService.listRuns(
    auth.value.user.id,
    id,
    agentId,
    query.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
