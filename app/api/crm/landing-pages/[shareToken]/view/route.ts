import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { RecordCrmLandingPageViewSchema } from '@/src/schemas/crm-landing-page.schema'
import { CrmLandingPageService } from '@/src/services/crm-landing-page.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ shareToken: string }> }

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

  const limit = await consume(apiLimiter, `ip:${ip}`)
  if (!limit.ok) return handleError(limit.error)

  const { shareToken } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const parsed = RecordCrmLandingPageViewSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmLandingPageService.recordView(
    shareToken,
    ip,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
