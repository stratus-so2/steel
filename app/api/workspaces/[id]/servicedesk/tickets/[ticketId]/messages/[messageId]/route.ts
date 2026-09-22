import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateSdTicketMessageSchema } from '@/src/schemas/sd-ticket-message.schema'
import { SdTicketMessageService } from '@/src/services/sd-ticket-message.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; ticketId: string; messageId: string }>
}

/** O autor edita/exclui a própria mensagem em até 15 minutos. */
export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/servicedesk/tickets/[ticketId]/messages/[messageId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, ticketId, messageId }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request),
  ])
  if (!json.ok) return handleError(json.error)
  const parsed = UpdateSdTicketMessageSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await SdTicketMessageService.update(
    auth.value.user.id,
    id,
    ticketId,
    messageId,
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
    'DELETE /api/workspaces/[id]/servicedesk/tickets/[ticketId]/messages/[messageId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, ticketId, messageId } = await ctx.params
  const result = await SdTicketMessageService.remove(
    auth.value.user.id,
    id,
    ticketId,
    messageId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null)
})
