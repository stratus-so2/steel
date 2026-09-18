# Métricas da plataforma (painel admin)

`/admin/metrics` (API `GET /api/admin/metrics`, só admin global) mostra a
saúde da plataforma. Tudo é calculado em `AdminMetricsService`
(`src/services/admin-metrics.service.ts`) com funções puras em
`src/lib/metrics.ts`. Datas e meses no fuso `America/Sao_Paulo`.

## Métricas com fonte

| Métrica | Fonte e definição |
| ------- | ----------------- |
| Clientes ativos (30 dias) | workspaces com uso de módulo em `module_usage_daily` na janela |
| Workspaces com login (30 dias) | workspaces com algum membro cuja sessão foi atualizada na janela (sinal complementar, existe desde já) |
| MRR | assinatura `PAID` mais recente de cada workspace com plano pago; anual entra como valor/12. Não inclui clientes cobrados fora do AbacatePay (ex.: ENTERPRISE negociado) nem trials |
| Cancelamentos por mês | assinaturas `CANCELLED`/`EXPIRED` pelo mês do `updatedAt`, com MRR perdido |
| Uso por módulo | requisições e ações (escritas) por módulo, série diária e ranking de workspaces |

### Como o uso é coletado

Menor intrusão possível: nenhum service mudou. O `withAxiom`
(`lib/axiom/server.ts`), que já envolve todas as rotas, chama
`recordModuleUsage` depois de cada resposta. Só contam respostas < 400 de
`/api/workspaces/:id/{crm,whatsapp}/**` — sucesso ali implica sessão válida e
associação ao workspace, então o id do path é confiável. O contador é um
`HINCRBY` num hash do Redis por dia (`usage:module:YYYY-MM-DD`, TTL 8 dias);
o job `usage-rollup` do worker (a cada 15 min) copia os últimos 7 dias para
`module_usage_daily` com valor absoluto (idempotente). Rotas públicas
(`/api/crm/forms`, webhooks) e o ServiceDesk (sem API) não entram.

Limitações: a série começa no deploy (sem histórico retroativo); polling do
front conta como requisição — por isso a coluna "ações" (só escritas) é a
medida mais fiel de uso; cancelamentos usam `updatedAt` como data e não
distinguem uma assinatura que nunca chegou a ser paga.

## Métricas sem fonte de dados (placeholders no painel)

| Métrica | O que falta |
| ------- | ----------- |
| Tickets por produto | domínio do ServiceDesk: tabela de tickets com workspace, produto/módulo e status |
| Tempo de resposta | tickets com abertura e primeira resposta do agente (SLA) |
| Tempo de implantação | marcos de onboarding por cliente: data de contrato e "go-live" explícito (o primeiro uso já sai de `module_usage_daily`) |
| NPS | pesquisa de satisfação (e-mail/in-app) com nota 0–10 por usuário/workspace, em tabela própria |

Para uma data de cancelamento exata, `subscriptions` precisaria de
`paidAt`/`cancelledAt` gravados pelo webhook.
