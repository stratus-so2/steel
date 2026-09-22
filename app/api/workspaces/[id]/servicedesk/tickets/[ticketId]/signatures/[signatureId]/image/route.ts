import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdTicketSignatureService } from '@/src/services/sd-ticket-signature.service'
import { handleError } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; ticketId: string; signatureId: string }>
}

/** PNG da assinatura (bucket privado), conferindo o acesso ao chamado. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, ticketId, signatureId } = await ctx.params
  const result = await SdTicketSignatureService.image(
    auth.value.user.id,
    id,
    ticketId,
    signatureId,
  )
  if (!result.ok) return handleError(result.error)

  return new Response(new Uint8Array(result.value), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(result.value.byteLength),
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="assinatura-${signatureId}.png"`,
    },
  })
})
