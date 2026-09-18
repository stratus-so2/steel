# 0001 — Trunk-based em `main` com o CI como gate

- **Status:** Aceita
- **Data:** anterior a 2026-09 (registrada em 2026-09-18)
- **Decisores:** engenharia de produto

## Contexto

O time é pequeno e entrega várias vezes por dia. Um fluxo com branch `dev`,
PR por feature e janela de revisão atrasava a integração e gerava
ressincronizações entre branches sem ganho real de qualidade — os problemas
eram pegos pelos testes, não pela leitura do PR.

## Decisão

`main` é o tronco e o único branch de trabalho: commits pequenos e temáticos
(Conventional Commits) vão direto para `main`.

- Localmente, os hooks do Husky barram cedo: `pre-commit` roda
  `biome check` + `tsc --noEmit`; `commit-msg` roda o commitlint.
- No push, o `ci.yml` roda lint, typecheck, testes unit/integration/e2e,
  cobertura, build e os jobs de segurança (audit, Snyk, Semgrep, Gitleaks).
- O `cd.yml` só dispara via `workflow_run` de um CI **verde** em `main`: CI
  vermelho nunca chega à produção.
- PR é exceção: Dependabot e contribuidores externos.
- Nunca `git push --force` em `main`; tags de release são imutáveis.

## Consequências

- Integração contínua de verdade: não existe "merge grande" nem branch velho.
- A qualidade depende da suíte do CI; teste faltando = bug em produção. Por
  isso o roteiro de feature (SDD → TDD → Code) exige testes antes do código.
- Um commit quebrado bloqueia o deploy de todo mundo até ser corrigido ou
  revertido — ver [runbook de CI vermelho](../runbooks/ci-deploy-failure.md).
