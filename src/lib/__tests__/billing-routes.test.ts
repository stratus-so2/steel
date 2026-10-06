import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Route-level proof of the billing gate in both states. The e2e suite runs
// against one server with one env (billing on in CI), so the "off" side of
// the HTTP contract is pinned here, calling the handlers directly.

vi.mock('@/lib/axiom/server', () => ({
  withAxiom: (handler: unknown) => handler,
}))
vi.mock('@/lib/env/server', () => ({
  ABACATE_PAY_WEBHOOK_SECRET: 'whsec-test',
}))
vi.mock('@/src/lib/billing', () => ({ isBillingEnabled: vi.fn() }))
vi.mock('@/src/services/subscription.service', () => ({
  SubscriptionService: { handleWebhookEvent: vi.fn() },
}))

import { POST as webhook } from '@/app/api/payment/webhook/route'
import { isBillingEnabled } from '@/src/lib/billing'
import { ok } from '@/src/lib/result'
import { SubscriptionService } from '@/src/services/subscription.service'

const mockedBillingEnabled = vi.mocked(isBillingEnabled)
const mockedHandle = vi.mocked(SubscriptionService.handleWebhookEvent)

type Handler = (req: NextRequest) => Promise<Response>

function postWebhook(secret: string | null, body: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret !== null) headers['x-webhook-secret'] = secret
  const request = new Request('http://localhost/api/payment/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return (webhook as unknown as Handler)(request as NextRequest)
}

const completed = { event: 'subscription.completed', data: { id: 'bill_1' } }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/payment/webhook — billing off', () => {
  beforeEach(() => mockedBillingEnabled.mockReturnValue(false))

  it('answers 404 without reading or processing the event', async () => {
    const res = await postWebhook('whsec-test', completed)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(mockedHandle).not.toHaveBeenCalled()
  })

  it('answers 404 even without a secret (the endpoint does not exist)', async () => {
    const res = await postWebhook(null, completed)

    expect(res.status).toBe(404)
    expect(mockedHandle).not.toHaveBeenCalled()
  })
})

describe('POST /api/payment/webhook — billing on', () => {
  beforeEach(() => mockedBillingEnabled.mockReturnValue(true))

  it('rejects a wrong secret with 401', async () => {
    const res = await postWebhook('wrong-secret', completed)

    expect(res.status).toBe(401)
    expect(mockedHandle).not.toHaveBeenCalled()
  })

  it('rejects a malformed payload with 422', async () => {
    const res = await postWebhook('whsec-test', { event: 'x' })

    expect(res.status).toBe(422)
    expect(mockedHandle).not.toHaveBeenCalled()
  })

  it('processes the event exactly as before', async () => {
    mockedHandle.mockResolvedValue(ok(undefined))

    const res = await postWebhook('whsec-test', completed)

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ received: true })
    expect(mockedHandle).toHaveBeenCalledWith(
      'subscription.completed',
      'bill_1',
    )
  })
})
