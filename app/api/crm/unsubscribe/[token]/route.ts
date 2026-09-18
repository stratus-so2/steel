import { type NextRequest, NextResponse } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmEmailUnsubscribeSchema } from '@/src/schemas/crm-email-opt-out.schema'
import { CrmEmailOptOutService } from '@/src/services/crm-email-opt-out.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ token: string }> }

/**
 * Descadastro público de campanhas de e-mail do CRM (sem sessão — o token
 * HMAC é a autorização; rota listada em PUBLIC_ROUTES do proxy).
 *
 * - `POST` com corpo `List-Unsubscribe=One-Click` (form-urlencoded): o POST
 *   one-click do RFC 8058 disparado pelo provedor de e-mail.
 * - `POST` vindo da página `/unsubscribe/<token>`: clique do titular.
 * - `GET`: redireciona para a página de confirmação — nunca descadastra em
 *   GET, que scanners de link disparam sozinhos.
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const { token } = await ctx.params
  return NextResponse.redirect(
    new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url),
    303,
  )
})

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const limit = await consume(
    apiLimiter,
    `ip:${request.headers.get('x-forwarded-for') ?? 'unknown'}`,
  )
  if (!limit.ok) return handleError(limit.error)

  const { token } = await ctx.params
  const parsed = CrmEmailUnsubscribeSchema.safeParse({ token })
  if (!parsed.success) {
    return standardError(
      'CRM_EMAIL_UNSUBSCRIBE_INVALID',
      'Link de descadastro inválido.',
    )
  }

  const body = await request.text().catch(() => '')
  const isOneClick =
    new URLSearchParams(body).get('List-Unsubscribe') === 'One-Click'

  const result = await CrmEmailOptOutService.unsubscribe(
    parsed.data.token,
    isOneClick ? 'ONE_CLICK' : 'LINK',
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
