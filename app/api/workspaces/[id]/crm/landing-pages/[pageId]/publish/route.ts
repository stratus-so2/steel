import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmLandingPageService } from '@/src/services/crm-landing-page.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; pageId: string }> }

async function setPublished(
  request: NextRequest,
  ctx: Params,
  published: boolean,
) {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    `${request.method} /api/workspaces/[id]/crm/landing-pages/[pageId]/publish`,
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, pageId } = await ctx.params

  const result = await CrmLandingPageService.setPublished(
    auth.value.user.id,
    id,
    pageId,
    published,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
}

export const POST = withAxiom((request: NextRequest, ctx: Params) =>
  setPublished(request, ctx, true),
)

export const DELETE = withAxiom((request: NextRequest, ctx: Params) =>
  setPublished(request, ctx, false),
)
