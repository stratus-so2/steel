import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdGithubWebhookService } from '@/src/services/sd-github-webhook.service'
import { handleError, successResponse } from '@/utils/http-response'

/** Teto do corpo do webhook do GitHub (payloads de issue/PR cabem folgados). */
const MAX_BODY_BYTES = 1024 * 1024

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  )
}

/**
 * Entrada pública do GitHub (liberada em `PUBLIC_ROUTES`): espelha o estado
 * da issue/PR vinculada ao chamado. Sem sessão — o acesso é a assinatura
 * `X-Hub-Signature-256`, conferida com o segredo do repositório conectado
 * sobre o corpo bruto. `X-GitHub-Delivery` é a chave de idempotência.
 */
export const POST = withAxiom(async (request: NextRequest) => {
  const limit = await consume(apiLimiter, `sd-github:${clientIp(request)}`)
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

  const result = await SdGithubWebhookService.handle({
    rawBody,
    signature: request.headers.get('x-hub-signature-256'),
    event: request.headers.get('x-github-event'),
    deliveryId: request.headers.get('x-github-delivery'),
  })
  if (!result.ok) return handleError(result.error)

  return successResponse({
    outcome: result.value.outcome,
    state: result.value.state ?? null,
  })
})
