import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdWhatsappConnectionService } from '@/src/services/sd-whatsapp-connection.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; connectionId: string }> }

/** QR code da Z-API para parear o número (só conexões Z-API). */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, connectionId } = await ctx.params
  const result = await SdWhatsappConnectionService.qrCode(
    auth.value.user.id,
    id,
    connectionId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
