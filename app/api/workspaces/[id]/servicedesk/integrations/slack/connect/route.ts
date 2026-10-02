import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdIntegrationService } from '@/src/services/sd-integration.service'
import { handleError } from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/**
 * Início do OAuth do Slack: redireciona (`302`) para a tela de autorização.
 * Abra no navegador — não é uma chamada JSON. O workspace viaja no `state`
 * assinado, porque o callback é um path fixo.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const result = await SdIntegrationService.beginSlackConnect(
    auth.value.user.id,
    id,
  )
  if (!result.ok) return handleError(result.error)

  return Response.redirect(result.value.authorizeUrl, 302)
})
