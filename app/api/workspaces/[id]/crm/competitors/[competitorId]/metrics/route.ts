import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmCompetitorMetricsQuerySchema } from '@/src/schemas/crm-competitor.schema'
import { CrmCompetitorService } from '@/src/services/crm-competitor.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; competitorId: string }> }

/** Série histórica do concorrente vs. a conta conectada, para `?range=`. */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, competitorId } = await ctx.params
  const rawRange = request.nextUrl.searchParams.get('range') ?? undefined
  const parsed = CrmCompetitorMetricsQuerySchema.safeParse({ range: rawRange })

  if (!parsed.success) {
    return standardError('VALIDATION_ERROR', 'Janela de tempo inválida')
  }

  const result = await CrmCompetitorService.getMetrics(
    auth.value.user.id,
    id,
    competitorId,
    parsed.data.range,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
