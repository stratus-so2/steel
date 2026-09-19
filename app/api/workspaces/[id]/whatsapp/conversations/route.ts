import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import type { WhatsAppConversationStatusFilter } from '@/src/repositories/whatsapp-conversation.repository'
import { StartWhatsAppConversationSchema } from '@/src/schemas/whatsapp-conversation.schema'
import { WhatsAppConversationService } from '@/src/services/whatsapp-conversation.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

// OPEN = não fechadas (NEW + IN_PROGRESS): a caixa de entrada ativa.
const VALID_STATUSES = new Set(['NEW', 'IN_PROGRESS', 'CLOSED', 'OPEN'])

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
          ? (status as WhatsAppConversationStatusFilter)
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

  const [{ id }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request, { allowEmpty: true }),
  ])
  if (!json.ok) return handleError(json.error)
  const body = json.value
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
