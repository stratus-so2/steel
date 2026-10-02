# 0017 — Sentry e PostHog, opcionais e inertes, sem origem nova na CSP

- **Status:** Aceita
- **Data:** 2026-10-02
- **Decisores:** dono do produto

## Contexto

A observabilidade do Steel era o **Axiom** (uma linha por requisição, trilha de
auditoria LGPD, web vitals, painel de analytics do admin) mais dois pacotes da
Vercel — `@vercel/analytics` e `@vercel/speed-insights` — que o app carregava
atrás do banner de cookies.

Os dois pacotes nunca coletaram nada aqui. Os beacons deles postam em
`/_vercel/insights/*` e `/_vercel/speed-insights/*`, caminhos que só existem
num deploy **na Vercel**; neste servidor eles batiam no gate de autenticação do
`proxy.ts` e voltavam 307 para `/sign-in`. Mesmo assim `va.vercel-scripts.com`
ocupava uma entrada no `connect-src`.

Faltavam duas coisas de verdade: a caixa de entrada de exceções não tratadas
(o Axiom é consulta, não alerta) e analytics de produto. O Nexo — base do
Steel — já tinha resolvido as duas com Sentry e PostHog.

Duas restrições pesaram na forma:

1. **A CSP não tem `'strict-dynamic'`** (ADR 0011). Cada origem nova tem de ser
   nomeada à mão em cada diretiva, e errar aqui já derrubou a plataforma
   publicada uma vez: todo chunk bloqueado, a página renderizando e nada
   clicável.
2. **As contas ainda não existiam** quando isso foi construído. Não dava para
   depender de DSN nem de chave para o app subir.

## Decisão

- **Entram Sentry** (erro não tratado no servidor, no edge e no cliente) e
  **PostHog** (analytics de produto). **Saem** `@vercel/analytics` e
  `@vercel/speed-insights`, com a entrada `va.vercel-scripts.com` do
  `connect-src`. **Ficam** o Axiom e o Google Analytics.
- **Divisão de trabalho com o Axiom** (documentada em `lib/sentry/options.ts`):
  o Axiom é o log do que aconteceu — inclusive os `logger.error` de falhas que
  o serviço **tratou** e devolveu como `AppError`; o Sentry é a caixa do que
  quebrou — exceções que ninguém pegou, que chegam pelo `onRequestError` do
  Next e pelos handlers globais do navegador. Como os serviços devolvem
  `Result` em vez de lançar (ADR 0002), um `AppError` mapeado por `handleError`
  nunca vira issue — é esse o ponto: a lista de issues continua sendo uma lista
  de bugs.
- **Nenhuma origem nova para o PostHog.** O navegador fala com `/ingest` na
  nossa própria origem e o `next.config.ts` reescreve para o host configurado.
  `'self'` já cobre. De quebra, as requisições sobrevivem às blocklists que
  reconhecem `*.i.posthog.com` pelo nome. O custo é que o tráfego de analytics
  transita pelo nosso servidor — aceitável para o volume que esta configuração
  permite (page view e evento nomeado, sem autocapture e sem recording).
- **O Sentry ganha uma única entrada, só em `connect-src`**, e a origem é
  **derivada do DSN** (`new URL(dsn).origin`), porque o subdomínio carrega o id
  da organização e a região. Deploy sem DSN não ganha host extra nenhum. O
  `tunnelRoute` do SDK foi recusado: ele transforma o app num POST não
  autenticado que encaminha para terceiro.
- **Tudo é opcional e inerte sem chave**, no mesmo contrato do
  `src/lib/storage/offsite-backup.ts`: sem `NEXT_PUBLIC_SENTRY_DSN` o
  `instrumentation.ts` não importa o SDK (ele nem entra no grafo de módulos em
  runtime); sem `NEXT_PUBLIC_POSTHOG_KEY` o `loadPostHog()` resolve `null`, o
  chunk do `posthog-js` nunca é buscado e a rota `/ingest` não existe. O app
  sobe igual, sem erro e sem log de pânico.
- **O PostHog entra atrás do consentimento**, junto dos outros trackers em
  `app/_components/user/cookie-consent/consented-trackers.tsx`. O Sentry
  **não**: ele não carrega identidade de analytics, e é gated por configuração.
- **O que vai para fora é estreito.** O Sentry passa por `lib/sentry/scrub.ts`
  antes de enviar: identidade reduzida ao id do usuário, corpo/cookies/env da
  requisição descartados, cabeçalhos e parâmetros de query com cara de
  credencial redigidos. O PostHog roda sem autocapture, heatmap, dead click,
  session recording, survey, captura de exceção e web vitals; o único
  identificador enviado é o id do usuário — o mesmo valor que o
  `auditMutation` grava como `actorId`.
- **Source maps sobem só no build de imagem do CD**, quando `SENTRY_ORG`,
  `SENTRY_PROJECT` e `SENTRY_AUTH_TOKEN` existem. Um erro de credencial, uma
  oscilação de rede ou um rate limit do Sentry **avisam e seguem** — nunca
  viram deploy quebrado.
- **As cinco `NEXT_PUBLIC_*` são de build time**, e por isso entram como
  build-args no `Dockerfile` e vêm de GitHub Secrets no `cd.yml`. Conferido no
  navegador, com build de produção: um DSN definido apenas em runtime chega ao
  servidor, ao edge e à CSP do `proxy.ts` — a origem aparece no `connect-src` —
  mas **não** ao navegador (`window.__SENTRY__` indefinido e nenhuma
  requisição de ingestão depois de um erro não tratado). A chave do PostHog é
  lida pelo próprio `next.config.ts`, para montar o rewrite de `/ingest`, o que
  é build time por definição. `SENTRY_AUTH_TOKEN` é credencial e entra por
  secret mount, não por build-arg, para não ficar numa camada da imagem.

## Consequências

- Exceção não tratada passa a ter dono e stack trace legível; antes ela virava
  uma linha de log entre milhares.
- A CSP ganha **no máximo uma origem** (a do Sentry), e só quando há DSN. O
  `connect-src` ficou menor do que era, porque a entrada da Vercel saiu.
- O custo do proxy de mesma origem do PostHog: o tráfego de analytics passa
  pelo VPS. Se o volume crescer (autocapture, recording), isso vira um
  problema de banda e a decisão tem de ser revisitada.
- **Enquanto o dono não criar as contas**, as duas integrações ficam inertes:
  nenhum erro aparece no Sentry e nenhum evento no PostHog. Nada mais muda.
- **Pendência conhecida e medida:** o Google Analytics, que ficou como estava,
  carrega seu script de `googletagmanager.com`, origem que o `script-src`
  recusa — e o `@next/third-parties/google` injeta a tag pelo cliente depois da
  hidratação, portanto sem nonce. Na build de produção, depois de aceitar o
  banner de cookies, o Chromium reporta:

  ```
  Loading the script 'https://www.googletagmanager.com/gtag/js?id=G-…'
  violates the following Content Security Policy directive:
  "script-src 'self' 'nonce-…'". Note that 'script-src-elem' was not
  explicitly set, so 'script-src' is used as a fallback.
  The action has been blocked.
  ```

  Ou seja: **o GA não coleta nada hoje**. Decidir: nomear a origem
  explicitamente em `script-src` (e o host de coleta em `connect-src`), ou
  tirar o GA e ficar com PostHog + Axiom.
- **Quem for mexer na CSP**: a verificação não é ler o cabeçalho, é abrir a
  build de produção no navegador e **clicar**. Página que renderiza e não
  hidrata parece saudável de longe.
