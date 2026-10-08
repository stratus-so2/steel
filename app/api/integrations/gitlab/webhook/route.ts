import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdGitlabWebhookService } from '@/src/services/sd-gitlab-webhook.service'
import { handleError, successResponse } from '@/utils/http-response'

/** Body cap of the GitLab webhook. */
const MAX_BODY_BYTES = 1024 * 1024

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  )
}

/**
 * Public GitLab entry (in `PUBLIC_ROUTES`, ADR 0024): mirrors the state of
 * the issue/merge request linked to a ticket. No session — access is the
 * project's secret token in `X-Gitlab-Token` (constant-time compare);
 * `X-Gitlab-Event-UUID` / `Idempotency-Key` make retries harmless.
 */
export const POST = withAxiom(async (request: NextRequest) => {
  const limit = await consume(apiLimiter, `gl-webhook:${clientIp(request)}`)
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

  const result = await SdGitlabWebhookService.handle({
    rawBody,
    token: request.headers.get('x-gitlab-token'),
    event: request.headers.get('x-gitlab-event'),
    deliveryId:
      request.headers.get('x-gitlab-event-uuid') ??
      request.headers.get('idempotency-key'),
  })
  if (!result.ok) return handleError(result.error)

  return successResponse({
    outcome: result.value.outcome,
    state: result.value.state ?? null,
  })
})
