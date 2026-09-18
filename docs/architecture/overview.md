# Arquitetura do Steel — visão macro

O **Steel** é a plataforma multi-tenant da Stratus Telecom que junta, num
mesmo workspace, **ServiceDesk**, **CRM** e **Comunicação (WhatsApp
Business)**. Nasceu da base **Nexo** (gestão de projetos): auth, workspaces,
billing, status page, e-mails e a arquitetura em camadas vêm de lá; os
módulos CRM e Comunicação foram construídos em cima.

Stack: Next.js 16 (App Router) · PostgreSQL 17 / Prisma 7 · Redis 8 (TLS) ·
BullMQ · MinIO (S3) · Better Auth · Axiom (logs) · pnpm.

## Visão geral

```
                    Internet
                       │  HTTPS
                  ┌────▼─────┐
                  │  nginx   │  TLS, proxy; /media/ → MinIO (buckets públicos)
                  └────┬─────┘
                       │ :3000
   ┌───────────────────▼──────────────────┐      ┌──────────────────────────┐
   │ nextjs-app (imagem ghcr steel)        │      │ steel-worker (mesma imagem│
   │  proxy.ts → app/ (UI + app/api/**)    │      │  `node dist/worker.cjs`)  │
   │  rota → service → repository → Prisma │      │  BullMQ Workers + crons   │
   └──┬──────────────┬──────────────┬──────┘      └──┬──────────┬───────────┬─┘
      │              │              │                │          │           │
 ┌────▼────┐   ┌─────▼─────┐   ┌────▼─────┐          │          │           │
 │steel-db │   │steel-redis│   │steel-minio│◄─────────┴──────────┴───────────┘
 │PG 17    │   │TLS, filas,│   │S3: mídia, │
 │:5433    │   │cache, rate│   │backups,   │──── cópia offsite (S3 externo)
 └─────────┘   │limit, pub/│   │exports    │     do backup FULL diário
               │sub        │   └───────────┘
               └───────────┘
 Externos: Resend (e-mail) · AbacatePay (pagamento) · Meta Cloud API / Z-API
 (WhatsApp) · OpenAI/Anthropic (IA) · Google/GitHub OAuth · redes sociais
 (Meta, TikTok, X, LinkedIn, YouTube, Google Ads) · Axiom (logs)
```

## Camadas (fluxo de uma requisição)

```
app/api/**/route.ts  →  Service        →  Repository   →  Prisma
  withAxiom              regras, authz,    só acesso a      PostgreSQL
  sessão, rate limit,    auditoria         dados
  Zod safeParse          → Result          → Result
```

- **Rota** (`app/api/**/route.ts`): fina. `withAxiom` → `getAuthSession()` →
  `consume(apiLimiter, ...)` → validação Zod → service → `successResponse` /
  `handleError`.
- **Service** (`src/services/*.service.ts`): regras de negócio,
  **autorização** (ownership, papel no workspace, acesso ao módulo) e
  auditoria (`auditMutation`/`auditAuth`, `lib/axiom/audit`).
- **Repository** (`src/repositories/*.repository.ts`): Prisma puro, sem regra.
- **Mapper** (`src/mappers`): model Prisma → DTO da API.
- **Schema** (`src/schemas`): Zod de entrada/saída (contrato primeiro).
- **Cache** (`src/cache`): read-through no Redis (workspace, user, status...).
- Nada lança exceção entre camadas: tudo devolve `Result<T, AppError>`
  ([ADR 0002](../adr/0002-result-type-instead-of-exceptions.md)).

`proxy.ts` (não `middleware.ts`) é a entrada de toda requisição: nonce de CSP,
headers de segurança, log e gate de autenticação (rotas públicas passam; o
resto exige o cookie `better-auth.session_token`).

## Multi-tenancy e acesso a módulos

- Tudo é escopado por **workspace**; URLs privadas são
  `app/(private)/[workspace-slug]/...`. Papéis: `OWNER`, `ADMIN`, `MEMBER`,
  `VIEWER` (`src/lib/permissions.ts`, `src/services/authz.ts`).
- **Módulos** (`enum ModuleKind`: `SERVICE_DESK`, `CRM`, `COMMUNICATION`) são
  habilitados por workspace (`WorkspaceModuleAccessService`). Os layouts de
  cada módulo chamam `hasModuleAccess()` (`src/lib/module-access-guard.ts`) e
  respondem `notFound()` se o workspace não tiver o módulo.
- Um workspace pode apontar um módulo para um **Postgres externo próprio**
  (`WorkspaceModuleConnection`, credenciais cifradas com `CONNECTION_SECRETS`,
  resolvido por `src/lib/module-db/resolver.ts`).
- Planos (`FREE`, `PRO`, `BUSINESS`, `ENTERPRISE`) em `src/config/plans.ts` —
  ver [revisão de limites](../plans-review.md).
- **Feature flags** por workspace (capacidades opcionais dentro de um módulo,
  default por plano + override do admin): [feature-flags](../feature-flags.md).

## Módulos de domínio

| Módulo | UI | API / serviços |
| ------ | -- | -------------- |
| **CRM** | `[workspace-slug]/crm/*` — leads, pessoas, empresas, oportunidades, pipelines, propostas, produtos, forecast, cotas, relatórios, dashboards, campanhas de e-mail, listas, landing pages, formulários, workflows, redes sociais, IA | `src/services/crm-*.service.ts`, `app/api/crm/*` (forms, landing pages, propostas, integrações, workflows) |
| **Comunicação (WhatsApp)** | `[workspace-slug]/zap/*` — conversas, contatos, grupos, templates, respostas rápidas, transmissões, dashboards, relatórios, configurações | `src/services/whatsapp-*.service.ts`, `src/lib/whatsapp/*` (Meta Cloud API e Z-API), webhooks em `app/api/whatsapp/webhook/{meta,zapi}`, tempo real via SSE `app/api/whatsapp/events` (Redis pub/sub) |
| **ServiceDesk** | `[workspace-slug]/servicedesk` | casca; domínio ainda em construção |
| **Base (Nexo)** | auth, onboarding, settings (membros, billing, conexões), wiki, IA, sticky notes, short links, `/status`, `/docs` (Scalar) | `src/services/{workspace,membership,invitation,subscription,user,...}.service.ts` |

Campanhas de e-mail e transmissões do WhatsApp respeitam o descadastro LGPD
(link + `List-Unsubscribe` no e-mail, palavras-chave no WhatsApp) — regras,
registro e política de reinscrição em [LGPD — descadastro](../lgpd.md).

## Worker (BullMQ)

Processo Node separado (`worker/index.ts`, build `pnpm worker:build` →
`dist/worker.cjs`), mesma imagem Docker do app, container `steel-worker`.
Registra um `Worker` por fila e agenda os jobs repetíveis no boot
(`src/lib/queue/scheduler.ts`, fuso `America/Sao_Paulo`).

| Fila | Processor | Disparo |
| ---- | --------- | ------- |
| `data-retention` | limpa sessões/tokens expirados, expira convites | cron 03:00 |
| `account-lifecycle` | exclusão agendada de conta (30 dias) | sob demanda |
| `data-export` | export LGPD dos dados do usuário | sob demanda |
| `trial-lifecycle` | reverte trials vencidos | cron de hora em hora |
| `whatsapp-media` | baixa mídia recebida | por mensagem |
| `whatsapp-ai-reply` | resposta automática por IA | por mensagem |
| `whatsapp-sentiment` | análise de sentimento | por mensagem |
| `whatsapp-broadcast` | envio de transmissões + tick de agendadas | sob demanda + a cada 5 min |
| `whatsapp-conversation-lifecycle` | fecha conversas inativas (janela por workspace, padrão 24h) | a cada 15 min |
| `crm-scheduled-send` | campanhas de e-mail agendadas | a cada 5 min |
| `crm-workflow-schedule` | workflows `on-a-schedule` | a cada 1 min |
| `crm-competitor-sync` | métricas de concorrentes | cron 04:00 |
| `crm-proposal-expiry` | expira propostas com validade vencida e avisa o responsável | cron 00:05 |
| `crm-social-posts-tick` | publica posts sociais vencidos | a cada 1 min |
| `crm-social-publish` | publicação interativa de mídia grande | sob demanda |
| `changelog` | e-mails de changelog | sob demanda |
| `database-backup` | backup FULL (03:15), prune (03:30), backup por workspace, **cópia offsite** | cron + sob demanda |
| `status-collect` | probes do `/status` ([ADR 0004](../adr/0004-status-collection-worker-jobs.md)) | core 1 min, periféricos 5 min |
| `usage-rollup` | copia o uso por módulo do Redis para `module_usage_daily` ([métricas](../admin-metrics.md)) | a cada 15 min |

Dashboard das filas: `/jobs` (Workbench, basic auth `WORKBENCH_USER`/`WORKBENCH_PASS`).

## Infraestrutura

| Serviço | Container | Porta (host) | Observação |
| ------- | --------- | ------------ | ---------- |
| App Next | `nextjs-app` | 3000 | `docker-compose.yml`, atrás do nginx |
| Worker | `steel-worker` | — | mesma imagem, `node dist/worker.cjs` |
| PostgreSQL 17 | `steel-db` | 5433 → 5432 | `docker-compose.infra.yml`, volume `pgdata` |
| Redis 8 (TLS) | `steel-redis` | 6380 → 6379 | bitnami fixado por digest; certificados em `redis-tls/`; URL `rediss://` |
| MinIO | `steel-minio` | 127.0.0.1:9002 (API), 127.0.0.1:9003 (console) | imagem `quay.io/minio/minio`; API nunca exposta publicamente |

Todos na rede Docker `steel_default`. Segredos de produção versionados
cifrados com SOPS em `secrets/production.enc.env`; o CD decripta para
`/var/www/steel/.env`. Variáveis de ambiente passam sempre pelos schemas Zod
em `lib/env/` (`env.ts` público, `server.ts` servidor).

**Local:** `pnpm dev` sobe a infra e o Next em **:3001**; preview de e-mails
(`pnpm email`) em **:3002**. A porta 3000 fica reservada ao container de
produção (e a outro projeto na máquina de desenvolvimento).

## Backups

- **FULL diário 03:15** (`pg_dump --format=custom`), cifrado pela aplicação
  (AES-256-GCM com `CONNECTION_SECRETS`) e gravado no bucket
  `database-backups` do MinIO; registro na tabela `backups`; retenção 90 dias
  (prune 03:30).
- **Cópia offsite**: após cada FULL, o job `copy-to-offsite` sobe o mesmo
  objeto cifrado para um storage S3-compatível externo (`BACKUP_OFFSITE_*`),
  com SSE e verificação por leitura; retenção própria
  (`BACKUP_OFFSITE_RETENTION_DAYS`, padrão 90). Inerte se não configurado.
- **Backup por workspace** sob demanda (`pnpm backup:workspace`).
- Restore: [runbook](../runbooks/restore-backup.md).

## Entrega

Trunk-based em `main` ([ADR 0001](../adr/0001-trunk-based-main-ci-gate.md)):
push → `ci.yml` (lint, typecheck, unit, integration, e2e, build, segurança) →
se verde, `cd.yml` no runner self-hosted do servidor
([ADR 0005](../adr/0005-self-hosted-runner-on-prod-server.md)): migrations →
build + Trivy + push da imagem → `docker compose pull && up -d` em
`/var/www/steel` → tag CalVer + GitHub Release
([ADR 0003](../adr/0003-calver-versioning.md)) → aviso no Slack.
