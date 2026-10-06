import type { NextRequest } from 'next/server'
import { logger } from '@/lib/axiom/logger'
import { withAxiom } from '@/lib/axiom/server'
import { steelAiSseResponse } from '@/src/lib/ai/sse'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { aiMessageLimiter, apiLimiter, consume } from '@/src/lib/rate-limit'
import { SendAiMessageSchema } from '@/src/schemas/steel-ai.schema'
import { AiConversationService } from '@/src/services/ai-conversation.service'
import { SteelAiChatService } from '@/src/services/steel-ai-chat.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; conversationId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, conversationId } = await ctx.params
  const result = await AiConversationService.listMessages(
    auth.value.user.id,
    id,
    conversationId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/**
 * Sends a message and streams the turn as `text/event-stream`
 * (`event: <type>\ndata: <json>\n\n`, see `SteelAiStreamEvent`). Errors
 * detected before the stream starts answer with the JSON envelope.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(aiMessageLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/ai/conversations/[conversationId]/messages',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, conversationId }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request),
  ])
  if (!json.ok) return handleError(json.error)
  const parsed = SendAiMessageSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await SteelAiChatService.sendMessage(
    auth.value.user.id,
    id,
    conversationId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return steelAiSseResponse(result.value, (cause) =>
    logger.error('steel_ai.stream_failed', {
      component: 'SteelAiMessagesRoute',
      conversationId,
      message: cause instanceof Error ? cause.message : String(cause),
    }),
  )
})
