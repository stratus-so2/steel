import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { WhatsAppConversationService } from '@/src/services/whatsapp-conversation.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; conversationId: string }> }

const SetArchivedSchema = z.object({ archived: z.boolean() })

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, conversationId }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = SetArchivedSchema.safeParse(body)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await WhatsAppConversationService.setArchived(
    auth.value.user.id,
    id,
    conversationId,
    parsed.data.archived,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
