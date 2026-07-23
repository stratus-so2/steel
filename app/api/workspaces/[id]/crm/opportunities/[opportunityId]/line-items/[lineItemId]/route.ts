import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateCrmOpportunityLineItemSchema } from '@/src/schemas/crm-opportunity.schema'
import { CrmOpportunityLineItemService } from '@/src/services/crm-opportunity.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; opportunityId: string; lineItemId: string }>
}

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/crm/opportunities/[opportunityId]/line-items/[lineItemId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, opportunityId, lineItemId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = UpdateCrmOpportunityLineItemSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmOpportunityLineItemService.update(
    auth.value.user.id,
    id,
    opportunityId,
    lineItemId,
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
    'DELETE /api/workspaces/[id]/crm/opportunities/[opportunityId]/line-items/[lineItemId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, opportunityId, lineItemId } = await ctx.params

  const result = await CrmOpportunityLineItemService.remove(
    auth.value.user.id,
    id,
    opportunityId,
    lineItemId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
