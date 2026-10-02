import { NEXT_PUBLIC_SENTRY_DSN } from '@/lib/env/env'
import { clientSentryOptions } from '@/lib/sentry/options'

/**
 * Rastreamento de erro no navegador.
 *
 * O SDK é importado dinamicamente para que um deploy sem
 * `NEXT_PUBLIC_SENTRY_DSN` não envie nada dele: o chunk nunca é requisitado,
 * nenhum host de ingestão aparece no bundle e nada é enviado. O Next não
 * aguarda o trabalho iniciado aqui (ver a doc de `instrumentation-client`),
 * então os primeiros milissegundos após a hidratação ficam descobertos — uma
 * troca justa contra mandar o SDK inteiro para todo visitante de um deploy
 * que não tem DSN.
 *
 * O PostHog *não* é iniciado aqui: analytics de produto é gated por
 * consentimento e carrega pelo `<ConsentedTrackers />`. Rastreamento de erro
 * não carrega identidade de analytics, então é gated por configuração, não
 * por consentimento.
 */

type SentryModule = typeof import('@sentry/nextjs')

let sentry: SentryModule | null = null

const dsn = NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  void import('@sentry/nextjs')
    .then((module) => {
      module.init(clientSentryOptions(dsn))
      sentry = module
    })
    .catch(() => {
      // Rastreamento de erro que quebra o app que ele observa é pior que
      // nenhum.
    })
}

export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse',
): void {
  sentry?.captureRouterTransitionStart(url, navigationType)
}
