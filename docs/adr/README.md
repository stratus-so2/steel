# Architecture Decision Records (ADR)

Registro curto das decisões de arquitetura e operação do Steel que já estão
valendo. Cada ADR responde três perguntas: **qual era o contexto**, **o que foi
decidido** e **quais as consequências** (inclusive as ruins).

## Como usar

- Um arquivo por decisão: `NNNN-slug-curto.md`, numeração sequencial, nunca
  reaproveitada.
- Copie [`template.md`](./template.md) e preencha. Meia página é o tamanho
  certo; se passar de uma página, provavelmente são duas decisões.
- ADR é **append-only**: não reescreva uma decisão antiga. Se ela mudar, crie
  um ADR novo com `Status: Aceita` e marque o antigo como
  `Substituída por NNNN`.
- Status possíveis: `Proposta`, `Aceita`, `Substituída por NNNN`, `Descontinuada`.

## Índice

| #    | Decisão                                                                 | Status | Data       |
| ---- | ----------------------------------------------------------------------- | ------ | ---------- |
| 0001 | [Trunk-based em `main` com CI como gate](./0001-trunk-based-main-ci-gate.md) | Aceita | anterior a 2026-09 |
| 0002 | [`Result` em vez de exceções entre camadas](./0002-result-type-instead-of-exceptions.md) | Aceita | anterior a 2026-09 |
| 0003 | [Versionamento CalVer](./0003-calver-versioning.md)                      | Aceita | 2026-09-18 |
| 0004 | [Coleta do status page via jobs repetíveis do worker](./0004-status-collection-worker-jobs.md) | Aceita | 2026-09-18 |
| 0005 | [Runner self-hosted no servidor de produção (por ora)](./0005-self-hosted-runner-on-prod-server.md) | Aceita | 2026-09-13 |
| 0006 | [Assistente de IA central via Claude Code em container; sem dados pessoais de clientes nos prompts](./0006-central-ai-assistant-claude-code.md) | Aceita | 2026-09-13 |
| 0007 | [IA multi-provedor (OpenAI + Anthropic) habilitada por workspace](./0007-multi-provider-ai-per-workspace.md) | Aceita | 2026-09-18 |
