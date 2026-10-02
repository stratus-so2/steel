import { describe, expect, it, vi } from 'vitest'

// Mesmo módulo do `sentry-options.test.ts`, com o env de produção: um arquivo
// separado porque `lib/env/env.ts` lê o ambiente uma única vez, na carga, e
// `lib/sentry/options.ts` o importa estaticamente.
vi.mock('@/lib/env/env', () => ({
  NODE_ENV: 'production',
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'homologacao',
  NEXT_PUBLIC_SENTRY_RELEASE: undefined,
}))

const DSN = 'https://abc@o1.ingest.de.sentry.io/2'

const { clientSentryOptions, edgeSentryOptions, serverSentryOptions } =
  await import('@/lib/sentry/options')

describe('sentry options in production', () => {
  it('samples 10% of traces', () => {
    expect(serverSentryOptions(DSN).tracesSampleRate).toBe(0.1)
    expect(edgeSentryOptions(DSN).tracesSampleRate).toBe(0.1)
    expect(clientSentryOptions(DSN).tracesSampleRate).toBe(0.1)
  })

  it('prefers the explicit sentry environment over NODE_ENV', () => {
    expect(serverSentryOptions(DSN).environment).toBe('homologacao')
  })

  it('leaves the release undefined when the build did not stamp one', () => {
    expect(serverSentryOptions(DSN).release).toBeUndefined()
  })
})
