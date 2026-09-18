# 0004 — Coleta do status page via jobs repetíveis do worker

- **Status:** Aceita
- **Data:** 2026-09-18
- **Decisores:** engenharia de produto

## Contexto

O `/status` é alimentado pelos probes de `src/services/status/probes.ts`
(app, banco, Redis, auth, pagamento, e-mail, storage), gravados em
`HealthCheck` / `ComponentDaily` com abertura/fechamento automático de
incidentes. A coleta existia só como rotas HTTP protegidas por segredo
(`POST /api/status/collect/core` e `/peripheral`), mas **nada no repositório
as chamava** — sem cron externo, o status page ficava parado.

Opções: cron no host (`curl` a cada minuto), GitHub Actions agendado, ou o
worker BullMQ que já roda 24/7 com outros jobs repetíveis.

## Decisão

O **worker** agenda a coleta com `upsertJobScheduler` na fila
`status-collect` (`src/lib/queue/scheduler.ts → scheduleStatusCollectJobs`):

| Job                  | Tier        | Frequência                 |
| -------------------- | ----------- | -------------------------- |
| `collect-core`       | core        | a cada 1 min (`* * * * *`) |
| `collect-peripheral` | peripheral  | a cada 5 min (`*/5 * * * *`) |

- O processor (`src/lib/queue/processors/status-collect.ts`) chama
  `StatusService.collect(tier)` direto, sem HTTP.
- Como o worker roda fora do Next, o probe `app` faz um `GET /api/status`
  real em `STATUS_APP_PROBE_URL` (fallback `BETTER_AUTH_URL`). Em produção,
  use a URL interna da rede Docker (`http://nextjs-app:3000`).
- Sem retry (`attempts: 1`): o próximo tick já coleta de novo.
- As rotas HTTP continuam para disparo manual (header `x-status-secret`).

## Consequências

- Nenhuma peça nova de infraestrutura; o agendamento versiona junto com o código.
- Se o **worker** cair, o status page para de atualizar (não fica "vermelho"
  sozinho). O runbook [verificar se o sistema está no ar](../runbooks/health-check.md)
  inclui checar a idade do último check.
- Periféricos a cada 5 min limitam o consumo de quota das APIs externas
  (Resend, AbacatePay).
