import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmProposalService } from '@/src/services/crm-proposal.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; proposalId: string }> }

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
    `${request.method} /api/workspaces/[id]/crm/proposals/[proposalId]/publish`,
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, proposalId } = await ctx.params

  const result = await CrmProposalService.setPublished(
    auth.value.user.id,
    id,
    proposalId,
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
