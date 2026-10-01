# 0011 — CSP com nonce, sem `strict-dynamic`, por causa do Cache Components

- **Status:** Aceita
- **Data:** 2026-10-01
- **Decisores:** dono do produto

## Contexto

O `proxy.ts` monta uma CSP por requisição com um nonce novo. A política
original era `script-src 'self' 'nonce-…' 'strict-dynamic'` — o conjunto
recomendado para apps onde **todo** script nasce em tempo de requisição.

O app roda com **Cache Components** (`cacheComponents: true` no
`next.config.ts`), ou seja, a casca do HTML é pré-renderizada no build. Um
HTML gerado no build não pode carregar um nonce que só existe na requisição.
E `'strict-dynamic'` manda o navegador **ignorar** `'self'`: só executa quem
tem o nonce certo ou foi carregado por um script confiável.

Resultado em produção: a página chegava renderizada, todos os
`<script src="/_next/static/chunks/…">` eram bloqueados, o React nunca
hidratava e **nenhum botão respondia**. Reproduzido localmente com build de
produção e Chromium headless (`Refused to load the script … violates the
following Content Security Policy directive`), e confirmado no HTML servido
pela homologação, cujos chunks vinham sem nonce.

## Decisão

- A política é **`script-src 'self' 'nonce-<nonce>'`**, sem
  `'strict-dynamic'`. Os bundles são arquivos nossos, de mesma origem, e
  `'self'` cobre todos; o nonce continua valendo para os scripts inline que o
  Next gera nas partes dinâmicas.
- O `proxy.ts` envia a CSP **também nos cabeçalhos da requisição**
  (`requestHeaders.set('Content-Security-Policy', …)`), que é como o Next lê
  o nonce para carimbar nos próprios scripts.
- **Nada de script inline nosso na casca**: o script de tema virou
  `public/theme-init.js` (`script-src 'self'`), e o matcher do `proxy.ts` o
  libera pelo nome — sem exclusão de extensões em bloco, para `/openapi.json`
  continuar atrás do gate de autenticação.
- Script inline novo só com o nonce de `headers().get('x-nonce')`, e apenas
  em trecho dinâmico.

## Consequências

- Perdemos a proteção extra do `'strict-dynamic'` contra injeção de
  `<script src>` de mesma origem. Em troca, o app funciona com PPR e a
  política segue bloqueando inline e terceiros.
- Sobra uma violação conhecida e inofensiva: um trecho inline do próprio
  React na casca (`requestAnimationFrame(function(){$RT=performance.now()})`)
  é bloqueado; a função de revelação do streaming define esse valor sozinha.
- **Quem for endurecer a CSP**: reintroduzir `'strict-dynamic'` derruba a
  interface inteira enquanto houver rota pré-renderizada. Só faz sentido se o
  Next passar a nonce-ar a casca ou se o Cache Components for desligado — e
  aí com verificação no navegador, não só no cabeçalho.
