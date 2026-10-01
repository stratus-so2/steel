import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdAiPreServiceMessageSchema } from '@/src/schemas/sd-ai.schema'
import { SdAiService } from '@/src/services/sd-ai.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/**
 * Pré-atendimento do portal: envia uma mensagem do solicitante. Sem
 * `conversationId`, começa uma conversa nova; a resposta traz o turno da IA,
 * os artigos citados e o rascunho do chamado.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/ai/pre-service',
  )
  if (!consent.ok) return handleError(consent.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = SdAiPreServiceMessageSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { id } = await ctx.params
  const result = await SdAiService.preServiceMessage(
    auth.value.user.id,
    id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
