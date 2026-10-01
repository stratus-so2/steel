import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateWhatsAppConnectionSchema } from '@/src/schemas/whatsapp-connection.schema'
import { SdWhatsappConnectionService } from '@/src/services/sd-whatsapp-connection.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; connectionId: string }> }

/** Renomeia a conexão ou troca as credenciais (nunca devolvidas). */
export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/servicedesk/whatsapp/connections/[connectionId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = UpdateWhatsAppConnectionSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { id, connectionId } = await ctx.params
  const result = await SdWhatsappConnectionService.update(
    auth.value.user.id,
    id,
    connectionId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/** Remove a conexão; se era a ativa, o módulo fica sem WhatsApp. */
export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/servicedesk/whatsapp/connections/[connectionId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, connectionId } = await ctx.params
  const result = await SdWhatsappConnectionService.remove(
    auth.value.user.id,
    id,
    connectionId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null)
})
