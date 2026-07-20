import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ReactToWhatsAppMessageSchema } from '@/src/schemas/whatsapp-message.schema'
import { WhatsAppMessageService } from '@/src/services/whatsapp-message.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; conversationId: string; messageId: string }>
}

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, conversationId, messageId }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = ReactToWhatsAppMessageSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await WhatsAppMessageService.react(
    auth.value.user.id,
    id,
    conversationId,
    messageId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
