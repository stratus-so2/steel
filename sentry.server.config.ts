import * as Sentry from '@sentry/nextjs'
import { NEXT_PUBLIC_SENTRY_DSN } from '@/lib/env/env'
import { serverSentryOptions } from '@/lib/sentry/options'

// Importado pelo `register()` do `instrumentation.ts`, e só quando há DSN
// configurado — a guarda abaixo é o que torna o arquivo seguro de importar de
// qualquer forma.

if (NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init(serverSentryOptions(NEXT_PUBLIC_SENTRY_DSN))
}
