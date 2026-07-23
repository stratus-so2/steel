import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmLandingPageService } from '@/src/services/crm-landing-page.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ shareToken: string }> }

export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const limit = await consume(
    apiLimiter,
    `ip:${request.headers.get('x-forwarded-for') ?? 'unknown'}`,
  )
  if (!limit.ok) return handleError(limit.error)

  const { shareToken } = await ctx.params

  const result = await CrmLandingPageService.getPublicByShareToken(shareToken)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
