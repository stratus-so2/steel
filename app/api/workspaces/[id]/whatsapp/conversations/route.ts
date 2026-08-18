import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { StartWhatsAppConversationSchema } from '@/src/schemas/whatsapp-conversation.schema'
import { WhatsAppConversationService } from '@/src/services/whatsapp-conversation.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

const VALID_STATUSES = new Set(['NEW', 'IN_PROGRESS', 'CLOSED'])

export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const archived = searchParams.get('archived') === 'true'
  const connectionId = searchParams.get('connectionId') ?? undefined

  const result = await WhatsAppConversationService.list(
    auth.value.user.id,
    id,
    {
      status:
        status && VALID_STATUSES.has(status)
          ? (status as 'NEW' | 'IN_PROGRESS' | 'CLOSED')
          : undefined,
      archived,
      connectionId,
    },
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = StartWhatsAppConversationSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await WhatsAppConversationService.start(
    auth.value.user.id,
    id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
