import { EVENT } from '@axiomhq/logging'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// O `@axiomhq/nextjs` real depende do AsyncLocalStorage global do Next; aqui
// um dublê fiel ao contrato: chama o handler e depois onSuccess/onError.
vi.mock('@axiomhq/nextjs', () => ({
  getNextErrorStatusCode: () => 500,
  createAxiomRouteHandler:
    (
      _logger: unknown,
      config: {
        onSuccess: (d: unknown) => void
        onError: (d: unknown) => void
      },
    ) =>
    (handler: (req: Request, ctx: unknown) => Promise<Response>) =>
    async (req: Request, ctx: unknown) => {
      try {
        const res = await handler(req, ctx)
        config.onSuccess({ req, res, start: 10, end: 25 })
        return res
      } catch (error) {
        config.onError({ req, error, start: 10, end: 30 })
        throw error
      }
    },
}))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), flush: vi.fn(async () => {}) },
}))
vi.mock('@/src/lib/usage/module-usage', () => ({
  recordModuleUsage: vi.fn(async () => {}),
}))
vi.mock('@/src/lib/analytics/geoip', () => ({
  geolocateRequest: vi.fn(async () => ({
    country: 'Brasil',
    countryCode: 'BR',
    city: 'Recife',
  })),
}))

import { logger } from '@/lib/axiom/logger'
import { annotateRequest } from '@/src/lib/analytics/request-context'
import { recordModuleUsage } from '@/src/lib/usage/module-usage'
import { withAxiom } from '../axiom/server'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const lastEvent = () => {
  const call = vi.mocked(logger.log).mock.calls.at(-1)
  const report = call?.[2] as Record<symbol, { request: Record<string, unknown> }>
  return { level: call?.[0], request: report[EVENT].request }
}

beforeEach(() => vi.clearAllMocks())

describe('withAxiom()', () => {
  it('logs the request with what the handler annotated', async () => {
    const route = withAxiom(async () => {
      annotateRequest({ userId: 'u1', workspaceId: 'w1' })
      return new Response(null, { status: 201 })
    })
    const res = await route(
      new NextRequest('https://steel.app/api/workspaces/w1/crm/leads', {
        method: 'POST',
      }),
      {},
    )
    await flush()

    expect(res.status).toBe(201)
    const { level, request } = lastEvent()
    expect(level).toBe('info')
    expect(request).toMatchObject({
      statusCode: 201,
      durationMs: 15,
      userId: 'u1',
      workspaceId: 'w1',
      country: 'Brasil',
    })
    expect(recordModuleUsage).toHaveBeenCalledWith({
      pathname: '/api/workspaces/w1/crm/leads',
      method: 'POST',
      status: 201,
    })
    expect(logger.flush).toHaveBeenCalled()
  })

  it('logs a thrown exception as a 500 with its (scrubbed) message', async () => {
    const route = withAxiom(async () => {
      throw new Error('falhou para joao@acme.com')
    })
    await expect(
      route(new NextRequest('https://steel.app/api/x'), {}),
    ).rejects.toThrow('falhou')
    await flush()

    expect(logger.error).toHaveBeenCalledWith(
      'falhou para joao@acme.com',
      expect.any(Error),
    )
    const { level, request } = lastEvent()
    expect(level).toBe('error')
    expect(request).toMatchObject({
      statusCode: 500,
      errorCode: 'Error',
      errorMessage: 'falhou para [email]',
    })
  })

  it('logs non-Error throws as 500 without the extra error line', async () => {
    const route = withAxiom(async () => {
      throw 'nope'
    })
    await expect(route(new NextRequest('https://steel.app/api/x'), {})).rejects.toBe(
      'nope',
    )
    await flush()
    expect(logger.error).not.toHaveBeenCalled()
    expect(lastEvent().request.statusCode).toBe(500)
  })
})
