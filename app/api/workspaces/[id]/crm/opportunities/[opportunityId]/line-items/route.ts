import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CreateCrmOpportunityLineItemSchema } from '@/src/schemas/crm-opportunity.schema'
import { CrmOpportunityLineItemService } from '@/src/services/crm-opportunity.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; opportunityId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, opportunityId } = await ctx.params

  const result = await CrmOpportunityLineItemService.list(
    auth.value.user.id,
    id,
    opportunityId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/crm/opportunities/[opportunityId]/line-items',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, opportunityId }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = CreateCrmOpportunityLineItemSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmOpportunityLineItemService.create(
    auth.value.user.id,
    id,
    opportunityId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
