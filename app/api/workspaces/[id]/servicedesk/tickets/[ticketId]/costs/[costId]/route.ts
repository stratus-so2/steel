import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateSdTicketCostSchema } from '@/src/schemas/sd-ticket-cost.schema'
import { SdTicketCostService } from '@/src/services/sd-ticket-cost.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; ticketId: string; costId: string }>
}

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/servicedesk/tickets/[ticketId]/costs/[costId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, ticketId, costId }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request),
  ])
  if (!json.ok) return handleError(json.error)
  const parsed = UpdateSdTicketCostSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await SdTicketCostService.update(
    auth.value.user.id,
    id,
    ticketId,
    costId,
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
    'DELETE /api/workspaces/[id]/servicedesk/tickets/[ticketId]/costs/[costId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, ticketId, costId } = await ctx.params
  const result = await SdTicketCostService.remove(
    auth.value.user.id,
    id,
    ticketId,
    costId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null)
})
