# 0005 — Runner self-hosted no servidor de produção (mantido por ora)

- **Status:** Aceita
- **Data:** 2026-09-13
- **Decisores:** dono do produto + TI

## Contexto

Os jobs `migrate` e `deploy` do `cd.yml` rodam em `runs-on: self-hosted` — um
runner do GitHub Actions instalado **no próprio servidor de produção**. Ele
decripta `secrets/production.enc.env` com SOPS para `/var/www/steel/.env`,
roda `prisma migrate deploy`, builda a imagem, escaneia com Trivy e faz
`docker compose pull && up -d` em `/var/www/steel`.

Isso dá ao runner acesso total ao host (Docker, banco, segredos). Alternativas
avaliadas: runner hospedado do GitHub + deploy via SSH, ou um runner em outra
máquina.

## Decisão

**Manter o runner self-hosted no servidor de produção por enquanto.**

- Deploy e migrations continuam como estão no `cd.yml`.
- Recomendação (a confirmar no servidor): o serviço do runner roda com um
  usuário dedicado, sem sudo, com acesso apenas ao Docker e a `/var/www/steel`.
- O CD só executa após CI verde em `main` (ver [0001](./0001-trunk-based-main-ci-gate.md)),
  e o checkout do job de release não usa o ref do evento (proteção contra
  "pwn request").

## Consequências

- Simples e rápido: sem SSH, sem chave de deploy extra, sem registry pull
  pela internet no caminho crítico.
- Risco aceito: um workflow comprometido executa código no servidor de
  produção. Mitigações: actions fixadas por SHA, PRs externos não disparam CD,
  segredos só via SOPS.
- Se o runner ficar offline, **nenhum deploy acontece** (o CI continua verde,
  mas o CD fica "queued") — ver [runbook de deploy](../runbooks/ci-deploy-failure.md).
- Revisitar quando houver um segundo servidor/ambiente ou auditoria de
  segurança.
