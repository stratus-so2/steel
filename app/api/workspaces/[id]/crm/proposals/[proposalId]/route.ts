import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateCrmProposalSchema } from '@/src/schemas/crm-proposal.schema'
import { CrmProposalService } from '@/src/services/crm-proposal.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; proposalId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, proposalId } = await ctx.params

  const result = await CrmProposalService.getById(
    auth.value.user.id,
    id,
    proposalId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/crm/proposals/[proposalId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, proposalId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = UpdateCrmProposalSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmProposalService.update(
    auth.value.user.id,
    id,
    proposalId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/crm/proposals/[proposalId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, proposalId } = await ctx.params

  const result = await CrmProposalService.remove(
    auth.value.user.id,
    id,
    proposalId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
