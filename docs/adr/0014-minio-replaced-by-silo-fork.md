# 0014 — Storage S3 na imagem Silo (fork do MinIO)

- **Status:** Aceita
- **Data:** 2026-10-01
- **Decisores:** dono do produto

## Contexto

O storage de objetos do Steel (mídia do WhatsApp e do CRM, anexos e
assinaturas do ServiceDesk, artigos da base de conhecimento, exports LGPD e
os backups do banco) sempre rodou MinIO, fixado em
`quay.io/minio/minio:RELEASE.2025-02-28T09-55-16Z`.

A MinIO arquivou o projeto open-source e tirou a distribuição pública do ar:
`quay.io/minio/minio` responde **401** em qualquer tag, o Docker Hub nega
acesso e `dl.min.io` devolve **410**. Na prática, um `docker compose pull`
numa máquina limpa não traz mais a imagem, e o job de e2e do CI quebrou de um
dia para o outro sem nenhuma mudança nossa.

O mesmo problema já tinha sido resolvido no Nexo, com a imagem **Silo**, fork
AGPL mantido do servidor MinIO.

## Decisão

- O storage passa a usar **`docker.io/pgsty/silo`**, pinado por release, em
  todos os lugares: `docker-compose.infra.yml` (local e servidor), o job de
  e2e do CI e a documentação.
- O cliente de linha de comando `minio/mc`, também fora do ar, dá lugar a
  **`pgsty/mc`** nos runbooks.
- Nada no código muda: a Silo é drop-in — mesmo comando (`server /data`),
  mesmas variáveis (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`), mesmo
  `/minio/health/live` e o mesmo diretório de dados, que foi lido sem
  conversão pelo volume existente (verificado ao recriar o container local).

## Consequências

- Volta a ser possível subir o ambiente do zero, e o CI tem a imagem de novo.
- Passamos a depender de um fork comunitário: pinamos a release, e uma
  atualização exige verificar compatibilidade de API S3 e do console.
- A API S3 continua fechada ao público (nginx serve só `/media/`), então a
  troca não muda superfície de exposição.
- Revisitar se a Silo parar de ser mantida, ou se o storage migrar para um S3
  gerenciado — hoje o custo e a soberania do dado pesam a favor de manter em
  casa.
