import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmLandingPageService } from '@/src/services/crm-landing-page.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; pageId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, pageId } = await ctx.params

  const result = await CrmLandingPageService.listViews(
    auth.value.user.id,
    id,
    pageId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
