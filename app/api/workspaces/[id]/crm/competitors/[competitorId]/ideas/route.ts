import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { GenerateCrmCompetitorIdeasSchema } from '@/src/schemas/crm-competitor.schema'
import { CrmCompetitorAnalysisService } from '@/src/services/crm-competitor-analysis.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; competitorId: string }> }

/** Latest generated idea set (`null` when none yet) — never spends AI quota. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, competitorId } = await ctx.params
  const result = await CrmCompetitorAnalysisService.getLatestIdeas(
    auth.value.user.id,
    id,
    competitorId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/** Generates a new idea set with the workspace AI (counts against the quota). */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const body = await request.json().catch(() => ({}))
  const parsed = GenerateCrmCompetitorIdeasSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return standardError('VALIDATION_ERROR', 'Janela de tempo inválida')
  }

  const { id, competitorId } = await ctx.params
  const result = await CrmCompetitorAnalysisService.generateIdeas(
    auth.value.user.id,
    id,
    competitorId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
