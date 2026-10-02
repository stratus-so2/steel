import { describe, expect, it, vi } from 'vitest'

// `NODE_ENV=test` faz o módulo de env devolver o objeto cru sem validar, então
// é aqui que os três valores que as opções leem são fixados.
vi.mock('@/lib/env/env', () => ({
  NODE_ENV: 'test',
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: undefined,
  NEXT_PUBLIC_SENTRY_RELEASE: '2026.10.02',
}))

const DSN = 'https://abc@o1.ingest.de.sentry.io/2'

const { clientSentryOptions, edgeSentryOptions, serverSentryOptions } =
  await import('@/lib/sentry/options')

describe('sentry options', () => {
  it('carries the dsn through to every runtime', () => {
    expect(serverSentryOptions(DSN).dsn).toBe(DSN)
    expect(edgeSentryOptions(DSN).dsn).toBe(DSN)
    expect(clientSentryOptions(DSN).dsn).toBe(DSN)
  })

  it('falls back to NODE_ENV when no sentry environment is set', () => {
    expect(serverSentryOptions(DSN).environment).toBe('test')
  })

  it('reports the configured release', () => {
    expect(serverSentryOptions(DSN).release).toBe('2026.10.02')
  })

  it('never sends default PII', () => {
    expect(serverSentryOptions(DSN).sendDefaultPii).toBe(false)
    expect(clientSentryOptions(DSN).sendDefaultPii).toBe(false)
    expect(edgeSentryOptions(DSN).sendDefaultPii).toBe(false)
  })

  it('keeps tracing off outside production', () => {
    expect(serverSentryOptions(DSN).tracesSampleRate).toBe(0)
  })

  it('keeps the SDK quiet so its console does not land in Axiom', () => {
    expect(serverSentryOptions(DSN).debug).toBe(false)
  })

  it('ignores App Router control flow and aborted navigations', () => {
    expect(serverSentryOptions(DSN).ignoreErrors).toEqual([
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
      'NEXT_HTTP_ERROR_FALLBACK',
      'AbortError',
      'The operation was aborted',
    ])
  })

  it('scrubs events and breadcrumbs on the way out', () => {
    const options = serverSentryOptions(DSN)
    expect(
      options.beforeSend({ user: { id: 'u1', email: 'a@b.com' } }).user,
    ).toEqual({ id: 'u1' })
    expect(
      options.beforeBreadcrumb({ message: 'a@b.com' })?.message,
    ).toBe('[email]')
  })

  it('turns Session Replay off in the browser', () => {
    const options = clientSentryOptions(DSN)
    expect(options.replaysSessionSampleRate).toBe(0)
    expect(options.replaysOnErrorSampleRate).toBe(0)
    expect(options.sendClientReports).toBe(false)
  })
})
