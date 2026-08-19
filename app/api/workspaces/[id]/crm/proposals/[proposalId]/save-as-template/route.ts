import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmProposalService } from '@/src/services/crm-proposal.service'
import { CrmProposalTemplateService } from '@/src/services/crm-proposal-template.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; proposalId: string }> }

export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/crm/proposals/[proposalId]/save-as-template',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, proposalId } = await ctx.params

  const proposal = await CrmProposalService.getById(
    auth.value.user.id,
    id,
    proposalId,
  )
  if (!proposal.ok) return handleError(proposal.error)

  const result = await CrmProposalTemplateService.createFromProposal(
    auth.value.user.id,
    id,
    proposal.value,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
