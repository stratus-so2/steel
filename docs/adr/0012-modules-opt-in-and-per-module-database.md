# 0012 — Módulos opt-in por workspace e banco próprio por módulo

- **Status:** Aceita
- **Data:** anterior a 2026-09 (registrado em 2026-10-01)
- **Decisores:** dono do produto

## Contexto

O Steel vende três módulos no mesmo produto (ServiceDesk, CRM e Comunicação)
para clientes diferentes, e nem todo workspace compra todos. Além disso, há
cliente que exige que **os dados do módulo dele fiquem num banco próprio**
(exigência contratual ou de compliance), sem deixar de usar a mesma
aplicação.

Esta decisão já estava implementada e descrita na
[visão de arquitetura](../architecture/overview.md), mas nunca virou ADR —
e ela define o comportamento de todo módulo novo.

## Decisão

- **Entitlement por workspace** (`WorkspaceModuleAccess`): um módulo só
  existe para o workspace se houver registro habilitado, concedido pelo admin
  global. É **opt-in**: sem registro, indisponível. Cada layout de módulo
  chama `hasModuleAccess()` e responde `notFound()` **no corpo do
  layout/page** (fora dele, o Cache Components não enxerga o marcador), e
  todo service passa por `assertModuleMember` / `assertModuleEnabled`.
- **Liberar o módulo semeia o padrão** (pipeline do CRM, dashboards do
  WhatsApp, ITIL + painéis do ServiceDesk). Seeds são idempotentes e falha de
  seed **não** bloqueia a concessão: fica no log e é refeita pelo backfill.
- **Banco por módulo** (`WorkspaceModuleConnection`): o workspace pode
  apontar um módulo para um Postgres próprio. Credenciais cifradas com
  `CONNECTION_SECRETS` e resolvidas por `src/lib/module-db/resolver.ts`, que
  mantém um cliente Prisma por `(workspace, módulo)` em cache, derrubando o
  que ficar ocioso por 10 minutos.

## Consequências

- Módulo novo nasce invisível: precisa de `ModuleKind`, gate no layout,
  `assertModuleMember` nos services e, se tiver configuração, um seed
  idempotente no momento da concessão.
- Migrações precisam valer para **todos** os bancos de módulo, não só o
  principal — o schema é um só; o que muda é onde as linhas moram.
- O cache de clientes tem custo de conexões: um workspace grande com banco
  próprio segura um pool extra enquanto estiver em uso.
- Revisitar se um módulo precisar de schema divergente por cliente (hoje não
  precisa) ou se o número de bancos externos crescer a ponto de exigir pool
  compartilhado.
