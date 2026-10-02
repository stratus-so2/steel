/**
 * Valores compartilhados pelo client do navegador (`lib/posthog/client.ts`) e
 * pelo build (`next.config.ts`). Mantido livre de `zod` e de `@/lib/env/*` de
 * propósito: o `next.config.ts` é avaliado antes de o módulo de env do app
 * ser seguro de importar.
 */

/**
 * Host de ingestão do projeto. Um projeto do PostHog pertence a uma região e
 * a chave só funciona lá; `us.i.posthog.com` é o default do PostHog Cloud.
 * Trocar de região significa projeto novo e chave nova — eventos não migram.
 * Sobrescreva com `NEXT_PUBLIC_POSTHOG_HOST` se a conta estiver na UE
 * (`https://eu.i.posthog.com`) ou for self-hosted.
 */
export const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com'

/**
 * Caminho de mesma origem com que o navegador conversa. Toda requisição do
 * PostHog é reescrita daqui pelo `next.config.ts`, o que mantém o
 * `connect-src` da CSP em `'self'` (nenhum host novo) e mantém as
 * requisições fora das blocklists que reconhecem `*.i.posthog.com` pelo nome.
 *
 * Isso importa mais no Steel que em outro app: a CSP do `proxy.ts` **não
 * usa `'strict-dynamic'`** por causa do Cache Components (ADR 0011), e cada
 * origem nova tem de ser nomeada à mão em cada diretiva. Pelo proxy de mesma
 * origem, o PostHog não precisa de nenhuma.
 */
export const POSTHOG_PROXY_PATH = '/ingest'

/**
 * O PostHog serve seus assets estáticos (remote config, toolbar) num irmão do
 * host de ingestão: `us.i.posthog.com` -> `us-assets.i.posthog.com`. Um
 * PostHog self-hosted serve os dois na mesma origem, então qualquer coisa que
 * não seja `<região>.i.posthog.com` volta sem alteração.
 *
 * O `(?<!-assets)` deixa a função idempotente: um
 * `NEXT_PUBLIC_POSTHOG_HOST=https://us-assets.i.posthog.com` configurado por
 * engano viraria `us-assets-assets` — um host que não existe, e o rewrite de
 * assets do `next.config.ts` passaria a apontar para o nada.
 */
export function posthogAssetHost(host: string): string {
  return host.replace(
    /^(https:\/\/[a-z0-9-]+(?<!-assets))(\.i\.posthog\.com)$/,
    '$1-assets$2',
  )
}
