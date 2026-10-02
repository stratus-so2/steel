import type { Instrumentation } from 'next'
import { NEXT_PUBLIC_SENTRY_DSN } from '@/lib/env/env'

/**
 * Boot de observabilidade do lado servidor.
 *
 * Sem `NEXT_PUBLIC_SENTRY_DSN` este arquivo não faz nada: os imports
 * dinâmicos abaixo nunca rodam, então o `@sentry/nextjs` nem entra no grafo
 * de módulos do bundle de servidor em tempo de execução. CI e
 * desenvolvimento, portanto, não precisam de DSN, e um deploy sem DSN não
 * paga custo nenhum — o mesmo contrato do
 * `src/lib/storage/offsite-backup.ts`: inerte quando não configurado.
 *
 * O Axiom *não* é iniciado aqui — ele é um logger comum, criado por módulo
 * (`lib/axiom/logger.ts`) e ligado aos route handlers pelo `withAxiom`.
 */

export async function register(): Promise<void> {
  if (!NEXT_PUBLIC_SENTRY_DSN) return
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * O Next entrega aqui todo erro que ele pegou ao renderizar uma página,
 * rodar um route handler, uma server action ou o proxy. São os **não
 * tratados**: um serviço que devolve `err(...)` nunca chega aqui, porque
 * nada foi lançado. Essa é a fronteira entre Sentry e Axiom — veja
 * `lib/sentry/options.ts`.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (!NEXT_PUBLIC_SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(error, request, context)
}
