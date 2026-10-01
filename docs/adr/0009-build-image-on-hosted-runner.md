# 0009 — Construir a imagem num runner hospedado; deploy segue no servidor

- **Status:** Aceita
- **Data:** 2026-10-01
- **Decisores:** dono do produto

## Contexto

O [ADR 0005](./0005-self-hosted-runner-on-prod-server.md) colocou todo o CD
num runner self-hosted dentro do servidor de produção. O servidor tem 7,8 GB
de RAM (≈6,5 GB livres fora de pico), divididos com o app, o worker,
Postgres, Redis e MinIO.

Com a entrada do **ServiceDesk** (ADR 0008) e do editor Plate da base de
conhecimento, o `pnpm build` dentro do Docker passou a estourar a memória: o
job `Build, Scan & Push Image` morreu com
`ResourceExhausted: process "/bin/sh -c … pnpm build …" did not complete`
(run 36864191635), bloqueando a publicação mesmo com o CI verde.

Baixar o teto do heap do V8 não resolve: o processo já roda com
`--max-old-space-size=2048` e esse teto vale só para o V8 — o grosso da
memória é do Turbopack, que não é limitado por ele. Mesmo com ~6,5 GB livres
o pico do build estourou, e ele ainda disputaria memória com a produção.

## Decisão

- O job **`Build, Scan & Push Image` passa a rodar em `ubuntu-latest`**
  (runner hospedado, 16 GB). Ele builda, roda o Trivy e empurra a imagem para
  o GHCR, como já fazia.
- O **deploy continua no runner self-hosted** (`migrate` e `deploy`): só ele
  tem acesso ao `/var/www/steel`, ao `.env` decifrado e aos containers. O
  servidor passa a apenas **baixar** a imagem pronta.
- O teto de memória do build virou o build-arg `NODE_BUILD_MEMORY`
  (padrão 2048 no `Dockerfile`, 6144 no CD), para que um build local numa
  máquina pequena continue com o teto antigo.

## Consequências

- A publicação deixa de depender da RAM livre do servidor, e o build não
  concorre mais com produção (menos risco de OOM no app durante o deploy).
- O build roda fora da nossa infra: os segredos usados nele
  (`HUGEICONS_TOKEN`, `NEXT_PUBLIC_AXIOM_*`) já eram segredos do repositório,
  então o perímetro não muda; nada do `.env` de produção vai para lá.
- O ADR 0005 continua válido para o que importa nele: deploy e migrações
  rodam de dentro do servidor, sem expor portas nem credenciais.
- Revisitar se o servidor ganhar RAM (ou se o custo de minutos hospedados
  incomodar): voltar o build para casa é só trocar o `runs-on`.
