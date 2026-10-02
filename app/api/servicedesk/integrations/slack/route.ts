import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdSlackInboundService } from '@/src/services/sd-slack-inbound.service'
import { handleError, successResponse } from '@/utils/http-response'

/** Teto do corpo que o Slack manda (eventos e atalhos são pequenos). */
const MAX_BODY_BYTES = 128 * 1024

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  )
}

/**
 * Entrada pública do Slack (liberada em `PUBLIC_ROUTES`): eventos, atalho de
 * mensagem e slash command no mesmo endereço. Sem sessão — o acesso é a
 * **assinatura** (`X-Slack-Signature` + `X-Slack-Request-Timestamp`),
 * verificada sobre o corpo bruto antes de qualquer interpretação.
 *
 * O `url_verification` do painel do app responde o `challenge` em texto
 * puro, como o Slack espera.
 */
export const POST = withAxiom(async (request: NextRequest) => {
  const limit = await consume(apiLimiter, `sd-slack:${clientIp(request)}`)
  if (!limit.ok) return handleError(limit.error)

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new Response('Corpo grande demais', { status: 413 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return new Response('Corpo inválido', { status: 400 })
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response('Corpo grande demais', { status: 413 })
  }

  const result = await SdSlackInboundService.handle({
    rawBody,
    signature: request.headers.get('x-slack-signature'),
    timestamp: request.headers.get('x-slack-request-timestamp'),
    contentType: request.headers.get('content-type'),
  })
  if (!result.ok) return handleError(result.error)

  if (result.value.outcome === 'challenge') {
    return new Response(result.value.challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return successResponse({
    outcome: result.value.outcome,
    ticketCode: result.value.ticketCode ?? null,
  })
})
