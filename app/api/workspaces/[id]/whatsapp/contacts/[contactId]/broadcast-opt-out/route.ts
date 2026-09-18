import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateWhatsAppContactBroadcastOptOutSchema } from '@/src/schemas/whatsapp-contact.schema'
import { WhatsAppContactService } from '@/src/services/whatsapp-contact.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; contactId: string }> }

/** Opt-out LGPD de transmissões pelo admin — ver
 * `WhatsAppContactService.setBroadcastOptOut` para a regra de reinscrição. */
export const PUT = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, contactId }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = UpdateWhatsAppContactBroadcastOptOutSchema.safeParse(body)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await WhatsAppContactService.setBroadcastOptOut(
    auth.value.user.id,
    id,
    contactId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
