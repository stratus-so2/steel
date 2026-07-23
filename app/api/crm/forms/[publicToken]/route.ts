import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmFormService } from '@/src/services/crm-form.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ publicToken: string }> }

export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const limit = await consume(
    apiLimiter,
    `ip:${request.headers.get('x-forwarded-for') ?? 'unknown'}`,
  )
  if (!limit.ok) return handleError(limit.error)

  const { publicToken } = await ctx.params

  const result = await CrmFormService.getPublicByToken(publicToken)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
