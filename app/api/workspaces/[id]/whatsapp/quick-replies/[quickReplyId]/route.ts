import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateWhatsAppQuickReplySchema } from '@/src/schemas/whatsapp-quick-reply.schema'
import { WhatsAppQuickReplyService } from '@/src/services/whatsapp-quick-reply.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; quickReplyId: string }> }

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, quickReplyId }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = UpdateWhatsAppQuickReplySchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await WhatsAppQuickReplyService.update(
    auth.value.user.id,
    id,
    quickReplyId,
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

  const { id, quickReplyId } = await ctx.params

  const result = await WhatsAppQuickReplyService.remove(
    auth.value.user.id,
    id,
    quickReplyId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
