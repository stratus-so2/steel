import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdGithubWebhookService } from '@/src/services/sd-github-webhook.service'
import { handleError, successResponse } from '@/utils/http-response'

/** Body cap of the GitHub webhook (issue/PR payloads fit comfortably). */
const MAX_BODY_BYTES = 1024 * 1024

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  )
}

/**
 * Public GitHub entry (in `PUBLIC_ROUTES`), workspace-level since ADR 0024:
 * mirrors the state of the issue/PR linked to a ticket. No session — access
 * is the `X-Hub-Signature-256` signature, checked with the repository secret
 * over the raw body. `X-GitHub-Delivery` is the idempotency key. The legacy
 * path `/api/servicedesk/integrations/github` serves the same handler.
 */
export const POST = withAxiom(async (request: NextRequest) => {
  const limit = await consume(apiLimiter, `gh-webhook:${clientIp(request)}`)
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
