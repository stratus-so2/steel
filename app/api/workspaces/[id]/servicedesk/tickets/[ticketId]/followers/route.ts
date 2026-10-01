import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdTicketFollowerService } from '@/src/services/sd-ticket-follower.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; ticketId: string }> }

const ROUTE =
  '/api/workspaces/[id]/servicedesk/tickets/[ticketId]/followers' as const

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, ticketId } = await ctx.params
  const result = await SdTicketFollowerService.list(
    auth.value.user.id,
    id,
    ticketId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/** Seguir o chamado (sempre em nome de quem chamou; idempotente). */
export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(auth.value.user.id, `POST ${ROUTE}`)
  if (!consent.ok) return handleError(consent.error)

  const { id, ticketId } = await ctx.params
  const result = await SdTicketFollowerService.follow(
    auth.value.user.id,
    id,
    ticketId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/** Parar de seguir (idempotente). */
export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(auth.value.user.id, `DELETE ${ROUTE}`)
  if (!consent.ok) return handleError(consent.error)

  const { id, ticketId } = await ctx.params
  const result = await SdTicketFollowerService.unfollow(
    auth.value.user.id,
    id,
    ticketId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
