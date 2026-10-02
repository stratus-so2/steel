import * as Sentry from '@sentry/nextjs'
import { NEXT_PUBLIC_SENTRY_DSN } from '@/lib/env/env'
import { edgeSentryOptions } from '@/lib/sentry/options'

// O runtime edge é onde o `proxy.ts` roda: o gate de autenticação, a CSP com
// nonce e a linha de log do Axiom. Importado pelo `register()` do
// `instrumentation.ts` só quando há DSN configurado.

if (NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init(edgeSentryOptions(NEXT_PUBLIC_SENTRY_DSN))
}
