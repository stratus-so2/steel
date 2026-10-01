# 0015 — Suíte dividida em projetos e piso de cobertura de 95%

- **Status:** Aceita
- **Data:** 2026-09-19 (registrado em 2026-10-01)
- **Decisores:** dono do produto

## Contexto

O CI é o único gate antes da produção ([ADR 0001](./0001-trunk-based-main-ci-gate.md)):
não há revisão humana obrigatória. Isso só se sustenta se a suíte for
confiável e se "passou nos testes" quiser dizer algo.

Testes rápidos e mockados não enxergam erro de SQL nem de rota; testes contra
banco e servidor real são lentos demais para rodar a cada arquivo salvo. E
cobertura sem piso vira enfeite: cada entrega grande dilui a anterior.

## Decisão

- A suíte é dividida em **projetos do Vitest** (`vite.config.ts`), e o lugar
  do arquivo decide onde ele roda:
  - **unit** — services, mappers, schemas, errors, libs e processors de fila,
    tudo mockado, em Node;
  - **integration** — repositories e cache contra Postgres e Redis de
    verdade, em série, truncando as tabelas a cada teste;
  - **e2e** — rotas HTTP contra o app em modo produção (`next start`);
  - **component** — React em jsdom;
  - **redis-tls** — smoke da conexão TLS.
- **Piso global de 95% nas quatro métricas** (statements, branches, functions
  e lines), medido em unit + integration sobre services, repositories,
  mappers, schemas, errors, cache, utils, `src/lib/ai`, `src/lib/analytics`,
  `src/lib/servicedesk` e os processors. Abaixo disso o job *Coverage Tests*
  reprova e o CD não roda.
- **Como atingir o piso importa**: nada de `/* v8 ignore */`, nada de excluir
  arquivo do `include`, nada de teste sem asserção. A cobertura é
  consequência de testar comportamento — caminho feliz, negação de
  autorização, erro de banco propagado, limite de domínio.

## Consequências

- Entrega grande vem com teste junto, ou não entra: foi o que segurou a
  qualidade das fatias do ServiceDesk construídas em paralelo.
- Rodar a suíte inteira é caro (minutos, e memória suficiente para derrubar
  uma máquina de 15 GB se tudo rodar junto); no dia a dia se roda o projeto e
  os caminhos afetados.
- O piso é global, não por arquivo: um módulo novo mal coberto derruba o
  número de todo mundo — de propósito, para o custo aparecer na hora.
- Revisitar se o tempo de CI virar gargalo: antes de baixar o piso, dá para
  paralelizar por projeto ou separar a medição de cobertura do caminho do
  merge.
