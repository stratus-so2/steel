import { EVENT } from '@axiomhq/logging'
import { describe, expect, it, vi } from 'vitest'
import { buildRequestLog, levelForStatus, logRequest } from '../axiom/request-log'

const CUID = 'k3v9x0q2m1n8b7c6z5a4s3d2'
const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

const requestOf = (report: Record<string | symbol, unknown>) =>
  (report[EVENT] as { request: Record<string, unknown>; source: string })

describe('buildRequestLog()', () => {
  it('builds an enriched route-handler event without IP or raw UA', () => {
    const [message, report] = buildRequestLog(
      {
        method: 'POST',
        url: `https://steel.app/api/workspaces/${CUID}/crm/leads?x=1`,
        headers: new Headers({
          'user-agent': CHROME,
          'x-forwarded-for': '200.1.2.3',
          referer: 'https://www.google.com/search?q=steel',
        }),
        statusCode: 422,
        startTime: 1000,
        endTime: 1042,
        context: {
          userId: 'u1',
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'E-mail joao@acme.com inválido',
        },
        geo: { country: 'Brasil', countryCode: 'BR', city: 'Recife' },
      },
      'lambda',
    )

    expect(message).toBe(
      `POST /api/workspaces/${CUID}/crm/leads 422 in 42ms`,
    )
    const event = requestOf(report)
    expect(event.source).toBe('lambda')
    expect(event.request).toEqual({
      startTime: 1000,
      endTime: 1042,
      durationMs: 42,
      path: `/api/workspaces/${CUID}/crm/leads`,
      route: '/api/workspaces/[id]/crm/leads',
      method: 'POST',
      host: 'steel.app',
      scheme: 'https',
      statusCode: 422,
      refererHost: 'www.google.com',
      userId: 'u1',
      workspaceId: CUID,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'E-mail [email] inválido',
      country: 'Brasil',
      countryCode: 'BR',
      city: 'Recife',
      browser: 'Chrome',
      os: 'Windows',
      device: 'desktop',
    })
    expect(JSON.stringify(event)).not.toContain('200.1.2.3')
    expect(JSON.stringify(event)).not.toContain('Mozilla')
  })

  it('describes a thrown exception', () => {
    const [, report] = buildRequestLog(
      {
        method: 'GET',
        url: 'http://localhost:3001/api/x',
        headers: new Headers(),
        statusCode: 500,
        startTime: 1,
        endTime: 2,
        error: new TypeError('Cannot read joao@acme.com'),
      },
      'lambda',
    )
    const { request } = requestOf(report)
    expect(request.errorCode).toBe('TypeError')
    expect(request.errorMessage).toBe('Cannot read [email]')
  })

  it('keeps the domain error over the thrown one', () => {
    const [, report] = buildRequestLog(
      {
        method: 'GET',
        url: 'http://localhost:3001/api/x',
        headers: new Headers(),
        statusCode: 500,
        context: { errorCode: 'DATABASE_ERROR', errorMessage: 'db' },
        error: new Error('raw'),
      },
      'lambda',
    )
    const { request } = requestOf(report)
    expect(request.errorCode).toBe('DATABASE_ERROR')
    expect(request.errorMessage).toBe('db')
  })

  it('builds a middleware page view with the workspace slug', () => {
    const [message, report] = buildRequestLog(
      {
        method: 'GET',
        url: 'https://steel.app/acme/crm/leads',
        headers: new Headers({ referer: 'not a url' }),
      },
      'middleware',
    )
    expect(message).toBe('GET /acme/crm/leads')
    const { request, source } = requestOf(report)
    expect(source).toBe('middleware')
    expect(request.route).toBe('/[workspace]/crm/leads')
    expect(request.workspaceSlug).toBe('acme')
    expect(request).not.toHaveProperty('statusCode')
    expect(request).not.toHaveProperty('refererHost')
    expect(request.device).toBe('unknown')
  })

  it('omits the duration without timestamps and a hostless referer', () => {
    const [message, report] = buildRequestLog(
      {
        method: 'GET',
        url: 'https://steel.app/api/x',
        headers: new Headers({ referer: 'about:blank' }),
        statusCode: 200,
      },
      'lambda',
    )
    expect(message).toBe('GET /api/x 200 in 0ms')
    expect(requestOf(report).request).not.toHaveProperty('refererHost')
  })

  it('names non-Error exceptions only through the context', () => {
    const [, report] = buildRequestLog(
      {
        method: 'GET',
        url: 'https://steel.app/api/x',
        headers: new Headers(),
        statusCode: 500,
        error: 'string thrown',
      },
      'lambda',
    )
    expect(requestOf(report).request).not.toHaveProperty('errorCode')
  })
})

describe('levelForStatus()', () => {
  it.each([
    [undefined, 'info'],
    [200, 'info'],
    [302, 'info'],
    [404, 'warn'],
    [503, 'error'],
  ])('%s → %s', (status, level) => {
    expect(levelForStatus(status)).toBe(level)
  })
})

describe('logRequest()', () => {
  it('logs with the level of the status', () => {
    const logger = { log: vi.fn() }
    logRequest(
      logger,
      {
        method: 'GET',
        url: 'https://steel.app/api/x',
        headers: new Headers(),
        statusCode: 503,
      },
      'lambda',
    )
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'GET /api/x 503 in 0ms',
      expect.any(Object),
    )
  })
})
