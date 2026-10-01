import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdWhatsappConnectionService } from '@/src/services/sd-whatsapp-connection.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; connectionId: string }> }

/** Testa as credenciais no provedor e atualiza o status da conexão. */
export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/whatsapp/connections/[connectionId]/test',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, connectionId } = await ctx.params
  const result = await SdWhatsappConnectionService.test(
    auth.value.user.id,
    id,
    connectionId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
