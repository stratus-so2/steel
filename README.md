<br />
<br />

<p  align="center">
    <a href="https://steel.stratustelecom.com.br" target="_blank" align="center">
      <img
        src="./public/brand/steel-readme.png"
        alt="Steel"
        width="50%"
        align="center"
      />
    </a>
</p>
<p align="center"><b>ServiceDesk, CRM, and Comunicação — one platform per workspace</b></p>

<p align="center">
    <a href="https://steel.stratustelecom.com.br/"><b>Website</b></a> •
    <a href="https://steel.stratustelecom.com.br/status"><b>Status</b></a> •
    <a href="https://x.com/steelpowers"><b>X</b></a> •
    <a href="https://steel.stratustelecom.com.br/docs"><b>Documentation</b></a>
</p>

<p align="center">
  <a href="https://www.react.doctor/share?p=steel&s=84&e=1&w=62&f=31">
    <img src="https://www.react.doctor/share/badge?p=steel&s=84&e=1&w=62&f=31" alt="React Doctor" />
  </a>

  <a href="https://codecov.io/gh/StratusTI/steel">
    <img src="https://codecov.io/gh/StratusTI/steel/graph/badge.svg?token=LHSP0EU1VT" alt="Codecov" />
  </a>

  <a href="https://github.com/StratusTI/steel/actions/workflows/cd.yml">
    <img src="https://github.com/StratusTI/steel/actions/workflows/cd.yml/badge.svg" alt="CD" />
  </a>
</p>

Meet [Steel](https://steel.stratustelecom.com.br/), a platform that brings ServiceDesk, CRM, and Comunicação (WhatsApp Business) into a single multi-tenant workspace. Each system ships built into Steel, and a workspace can optionally point any of them at its own external database instead of Steel's — same app, same queries, different data source.

> Steel is in active development. The foundation — auth, workspaces, billing, status, docs, and the ServiceDesk/CRM/Comunicação shell with per-workspace connection management — is in place. The actual domain data for each system (tickets, contacts, WhatsApp threads) is landing next. Suggestions, ideas, and reported bugs help us immensely.

## Installation

Two ways to run Steel:

- **Steel Cloud.** Sign up at [steel.stratustelecom.com.br](https://steel.stratustelecom.com.br) — the fastest path to get started, with no infrastructure to manage.
- **Self-host with Docker.** Bring your own infrastructure. The full stack runs from a single Compose file. See the [self-hosting documentation](https://steel.stratustelecom.com.br/docs).

| Installation method | Documentation                                          |
| ------------------- | ------------------------------------------------------ |
| Docker              | [Docker Compose guide](https://steel.stratustelecom.com.br/docs)   |

## Features

- **Workspaces.** Multi-tenant from day one. Slug-based URLs, role-based access (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`), and isolated data per team.
- **ServiceDesk, CRM, Comunicação.** Three systems built into Steel, selectable from the global nav per workspace.
- **Per-workspace database connections.** OWNER/ADMIN can point any system at a workspace-owned external Postgres instance (host/port/credentials, encrypted at rest) instead of Steel's own — validated with a live connection test before it's trusted.
- **Authentication.** Email and password, Google and GitHub OAuth, two-factor auth via OTP, email verification, and password reset.
- **Billing.** Plans (`FREE`, `PRO`, `BUSINESS`, `ENTERPRISE`) with AbacatePay integration and a webhook-driven subscription lifecycle.
- **Status page.** Built-in `/status` with proactive probes across seven components (app, database, cache, auth, payment, email, storage), incident timelines, post-mortems, and uptime history.
- **Transactional email.** React Email templates for welcome, OTP, password reset, account deletion, data export, invites, trial promotions, and incident post-mortems.
- **API documentation.** OpenAPI reference rendered with Scalar at `/docs`.

## Roadmap

The connection layer is in place; the domain data for each system is next:

- **ServiceDesk** — tickets, queues, SLAs, and agent assignment.
- **CRM** — contacts, companies, deals, and pipelines.
- **Comunicação** — WhatsApp Business threads, templates, and routing.
- **Shared Steel-hosted databases** — a default instance per system for workspaces that don't bring their own.

## Stack

- **Backend** — Next.js 16 (App Router), PostgreSQL, Prisma 7, Redis, BullMQ, MinIO, Better Auth, Resend.
- **Frontend** — React 19, Tailwind CSS 4, Base UI, TanStack Query, React Email, Hugeicons.
- **Quality** — Vitest, Biome, Commitlint, Husky.
- **Observability** — Axiom, Vercel Analytics and Speed Insights.

## Screenshots

<!--
  Drop product screenshots in the slots below — one per feature or flow.
  Suggested folder: ./public/brand/screens/<name>.png
-->

<p>
    <a href="https://steel.stratustelecom.com.br" target="_blank">
      <!-- <img src="./public/brand/screens/servicedesk.png" alt="ServiceDesk" width="100%" /> -->
    </a>
</p>

<p>
    <a href="https://steel.stratustelecom.com.br" target="_blank">
      <!-- <img src="./public/brand/screens/crm.png" alt="CRM" width="100%" /> -->
    </a>
</p>

<p>
    <a href="https://steel.stratustelecom.com.br" target="_blank">
      <!-- <img src="./public/brand/screens/comunicacao.png" alt="Comunicação" width="100%" /> -->
    </a>
</p>

<p>
    <a href="https://steel.stratustelecom.com.br" target="_blank">
      <!-- <img src="./public/brand/screens/connections.png" alt="Workspace connections" width="100%" /> -->
    </a>
</p>

<p>
    <a href="https://steel.stratustelecom.com.br" target="_blank">
      <!-- <img src="./public/brand/screens/status.png" alt="Status page" width="100%" /> -->
    </a>
</p>

## Local development

Spin up the infrastructure (Postgres, Redis, BullMQ worker, MinIO) with Docker Compose, then run the dev server:

```bash
pnpm install
pnpm docker:create        # first run only — creates and starts containers
pnpm prisma:migrate:dev   # apply migrations
pnpm dev
```

For subsequent runs, `pnpm infra` starts the containers and applies pending migrations in one step. See `docker-compose.infra.yml` and the `scripts` block in `package.json` for the full picture.

## Documentation

API reference and product documentation live at [steel.stratustelecom.com.br/docs](https://steel.stratustelecom.com.br/docs).

## Security

If you discover a security vulnerability, please report it responsibly instead of opening a public issue. Email **security@steel.stratustelecom.com.br** with a description and reproduction steps. We take all legitimate reports seriously and investigate them promptly.

## License

Proprietary. All rights reserved.
