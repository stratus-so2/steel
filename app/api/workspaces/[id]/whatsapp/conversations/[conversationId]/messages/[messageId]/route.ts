import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { WhatsAppMessageService } from '@/src/services/whatsapp-message.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; conversationId: string; messageId: string }>
}

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, conversationId, messageId } = await ctx.params

  const result = await WhatsAppMessageService.remove(
    auth.value.user.id,
    id,
    conversationId,
    messageId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
