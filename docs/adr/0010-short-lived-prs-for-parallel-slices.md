# 0010 — PRs de vida curta quando as fatias são construídas em paralelo

- **Status:** Aceita
- **Data:** 2026-10-01
- **Decisores:** dono do produto

## Contexto

O [ADR 0001](./0001-trunk-based-main-ci-gate.md) definiu trunk-based: commit
direto na `main`, CI como rede de segurança, PR só para Dependabot e
contribuição externa. Isso funciona bem para uma pessoa entregando um
incremento por vez.

Na construção do ServiceDesk (ADR 0008) o modo de trabalho mudou: várias
fatias grandes nascem **em paralelo**, cada uma na sua worktree, e chegam
prontas quase juntas. Integrando tudo de uma vez na `main`, a primeira
validação real acontece **depois** do merge — e foi o que houve: a `main`
ficou vermelha por dias (lockfile do `next`, lint com warnings, env faltando
no job de e2e, cobertura abaixo do piso), bloqueando o CD e, com ele, a
publicação de tudo o que já estava pronto.

O CI já roda em `pull_request` (`.github/workflows/ci.yml`), e o CD só
dispara a partir de execuções da `main`. Ou seja: validar cada fatia antes do
merge não custa configuração nenhuma.

## Decisão

Quando houver **fatias em paralelo** (duas ou mais frentes trabalhando ao
mesmo tempo, tipicamente agentes em worktrees):

- Cada fatia vive numa branch própria e entra por **PR**.
- O PR só é mesclado com o **CI verde** — é a prova de lint, tipos, testes,
  cobertura e e2e daquela fatia isoladamente.
- A branch é de **vida curta**: aberta e mesclada no mesmo dia. PR parado é
  problema, não processo; se a fatia não fecha no dia, ela é quebrada em
  partes menores.
- O merge continua sendo feito por quem integra, direto na `main` (sem
  revisão obrigatória de terceiros — o gate é o CI).

Fora desse cenário, **nada muda**: entrega sequencial de uma pessoa continua
indo direto para a `main`, como manda o ADR 0001.

## Consequências

- Uma fatia quebrada não derruba mais a `main` nem o CD: o vermelho fica no
  PR dela.
- O histórico ganha um merge commit por fatia, o que também dá um ponto de
  reversão claro.
- Custa mais minutos de CI (cada PR roda a suíte inteira) e exige disciplina
  de rebase, já que as fatias partem do mesmo ponto.
- Revisitar se a construção voltar a ser sequencial: aí o PR vira cerimônia
  sem ganho e o ADR 0001 basta sozinho.
