import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import z from 'zod'

vi.mock('@/lib/axiom/server', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  withAxiom: <T>(handler: T) => handler,
}))
vi.mock('@/src/lib/auth-session')
vi.mock('@/src/lib/consent')
vi.mock('@/src/lib/rate-limit', () => ({
  apiLimiter: {},
  consume: vi.fn(),
}))

import { rateLimited, unauthorized } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { consume } from '@/src/lib/rate-limit'
import { err, ok, type Result } from '@/src/lib/result'
import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'

const auth = vi.mocked(getAuthSession)
const consent = vi.mocked(requireConsent)
const limiter = vi.mocked(consume)

function request(url: string, body?: unknown): NextRequest {
  const init: RequestInit =
    body === undefined
      ? { method: 'GET' }
      : {
          method: 'POST',
          body: typeof body === 'string' ? body : JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }
  return new Request(url, init) as unknown as NextRequest
}

const ctx = (params: Record<string, string> = { id: 'ws1' }) => ({
  params: Promise.resolve(params),
})

beforeEach(() => {
  auth.mockResolvedValue(ok({ user: { id: 'u1' } }) as never)
  limiter.mockResolvedValue(ok(true) as never)
  consent.mockResolvedValue(ok(true) as never)
})

describe('sdConfigRoute()', () => {
  it('runs the chain and answers with the service payload', async () => {
    const handler = vi.fn().mockResolvedValue(ok({ id: 'd1' }))
    const route = sdConfigRoute({ handler })

    const response = await route(
      request('https://app.local/api/workspaces/ws1/servicedesk/departments'),
      ctx(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      statusCode: 200,
      data: { id: 'd1' },
    })
    expect(handler).toHaveBeenCalledWith({
      userId: 'u1',
      params: { id: 'ws1' },
      body: undefined,
      query: undefined,
    })
    expect(limiter).toHaveBeenCalledWith(expect.anything(), 'user:u1')
  })

  it('uses the configured success status and maps a missing payload to null', async () => {
    const route = sdConfigRoute({
      status: 201,
      handler: async () => ok(undefined),
    })

    const response = await route(request('https://app.local/x'), ctx())

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ data: null })
  })

  it('bails out when there is no session', async () => {
    auth.mockResolvedValue(err(unauthorized()) as never)
    const handler = vi.fn()

    const response = await route(handler)

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('bails out when the rate limit is exhausted', async () => {
    limiter.mockResolvedValue(err(rateLimited(30)) as never)
    const handler = vi.fn()

    const response = await route(handler)

    expect(response.status).toBe(429)
    expect(handler).not.toHaveBeenCalled()
  })

  it('checks the LGPD consent gate only when the route asks for it', async () => {
    const handler = vi.fn().mockResolvedValue(ok(null))
    await sdConfigRoute({ handler })(request('https://app.local/x'), ctx())
    expect(consent).not.toHaveBeenCalled()

    await sdConfigRoute({ consent: 'POST /x', handler })(
      request('https://app.local/x'),
      ctx(),
    )
    expect(consent).toHaveBeenCalledWith('u1', 'POST /x')
  })

  it('propagates a refused consent', async () => {
    consent.mockResolvedValue(err(unauthorized('Aceite os termos')) as never)
    const handler = vi.fn()

    const response = await sdConfigRoute({ consent: 'POST /x', handler })(
      request('https://app.local/x'),
      ctx(),
    )

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('parses the query string, turning repeated keys into a list', async () => {
    const handler = vi.fn().mockResolvedValue(ok([]))
    const route = sdConfigRoute({
      query: z.object({
        entity: z.string(),
        types: z.array(z.string()).optional(),
      }),
      handler,
    })

    const response = await route(
      request('https://app.local/x?entity=TICKET&types=A&types=B'),
      ctx(),
    )

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { entity: 'TICKET', types: ['A', 'B'] },
      }),
    )
  })

  it('answers 422 for an invalid query', async () => {
    const handler = vi.fn()
    const response = await sdConfigRoute({
      query: z.object({ entity: z.string() }),
      handler,
    })(request('https://app.local/x'), ctx())

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('parses the JSON body', async () => {
    const handler = vi.fn().mockResolvedValue(ok({ ok: true }))
    const response = await sdConfigRoute({
      body: z.object({ name: z.string() }),
      handler,
    })(request('https://app.local/x', { name: 'Infra' }), ctx())

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: 'Infra' } }),
    )
  })

  it('answers 422 for an invalid body', async () => {
    const handler = vi.fn()
    const response = await sdConfigRoute({
      body: z.object({ name: z.string() }),
      handler,
    })(request('https://app.local/x', { name: 1 }), ctx())

    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    // As `issues` do Zod vão no `details` e aparecem no formulário — por isso
    // precisam estar em pt-BR (ver src/lib/zod-locale.ts).
    expect(payload.error.details[0].message).toMatch(/inválido|esperado/i)
    expect(handler).not.toHaveBeenCalled()
  })

  it('propagates a malformed body error', async () => {
    const handler = vi.fn()
    const response = await sdConfigRoute({
      body: z.object({ name: z.string() }),
      handler,
    })(request('https://app.local/x', '{invalid'), ctx())

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(handler).not.toHaveBeenCalled()
  })

  it('accepts an empty body when the action allows it', async () => {
    const handler = vi.fn().mockResolvedValue(ok(null))
    const response = await sdConfigRoute({
      body: z.object({}).optional(),
      allowEmptyBody: true,
      handler,
    })(
      new Request('https://app.local/x', {
        method: 'POST',
      }) as unknown as NextRequest,
      ctx(),
    )

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalled()
  })

  it('maps a service error to its HTTP status', async () => {
    const response = await sdConfigRoute({
      handler: async () => err(unauthorized()),
    })(request('https://app.local/x'), ctx())

    expect(response.status).toBe(401)
  })

  it('passes every dynamic segment to the handler', async () => {
    const handler = vi.fn().mockResolvedValue(ok(null))
    await sdConfigRoute({ handler })(
      request('https://app.local/x'),
      ctx({ id: 'ws1', departmentId: 'd1' }),
    )

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: 'ws1', departmentId: 'd1' } }),
    )
  })
})

/** Rota mínima para os casos que só exercitam o começo da cadeia. */
async function route(handler: (...args: never[]) => unknown) {
  return sdConfigRoute({
    handler: handler as unknown as () => Promise<Result<unknown>>,
  })(request('https://app.local/x'), ctx())
}
