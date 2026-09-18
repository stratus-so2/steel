# Verificar se o sistema está no ar

**Quando usar:** alguém reportou erro/lentidão, alerta de monitoramento, ou
checagem de rotina depois de um deploy/reinício.

Siga na ordem; pare quando achar o problema e vá para o runbook indicado.

## 1. Status page (de fora, sem acessar o servidor)

1. Abra `https://<domínio>/status`.
2. Leia o estado de cada componente: **Aplicação, Banco de dados, Cache
   (Redis), Autenticação** (core) e **Assinatura, Envio de e-mail (Resend),
   Armazenamento (MinIO)** (periféricos).
3. Veja o horário da última atualização. O worker coleta os core **a cada 1
   min** e os periféricos **a cada 5 min**. Se nada mudou há mais de ~10 min,
   o **worker está parado** — vá ao passo 3 e reinicie o `steel-worker`.

Pela linha de comando:

```bash
curl -s https://<domínio>/api/status | head -c 600; echo
```

Resposta `"success":true` = app no ar. Erro 502/504 = o nginx está de pé mas
o app não responde.

## 2. Endpoints de saúde

| Checagem | Comando | Esperado |
| -------- | ------- | -------- |
| App (via nginx) | `curl -sI https://<domínio>/api/status` | `HTTP/2 200` |
| App (direto, no servidor) | `curl -sI http://localhost:3000/api/status` | `HTTP/1.1 200` |
| MinIO (no servidor) | `curl -sI http://127.0.0.1:9002/minio/health/live` | `200 OK` |
| Postgres (no servidor) | `docker exec steel-db pg_isready` | `accepting connections` |
| Redis (no servidor) | `docker exec steel-redis sh -c 'redis-cli --tls --cacert /opt/bitnami/redis/certs/ca.crt -a "$REDIS_PASSWORD" ping'` | `PONG` |

Forçar uma coleta do status page na hora (opcional; o segredo está no
`.env` como `STATUS_COLLECTOR_SECRET`):

```bash
cd /var/www/steel
SECRET=$(grep '^STATUS_COLLECTOR_SECRET=' .env | cut -d= -f2-)
curl -s -X POST -H "x-status-secret: $SECRET" http://localhost:3000/api/status/collect/core
curl -s -X POST -H "x-status-secret: $SECRET" http://localhost:3000/api/status/collect/peripheral
```

## 3. Containers

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' \
  | grep -E 'NAMES|nextjs-app|steel-'
```

Esperado: `nextjs-app`, `steel-worker`, `steel-db`, `steel-redis`,
`steel-minio` todos `Up`. Os de infra mostram `(healthy)`.

- `Restarting` ou `Exited` → veja os logs (passo 4) e depois
  [reinicie o serviço](./restart-service.md).
- `(unhealthy)` em `steel-db`/`steel-redis`/`steel-minio` → logs e reinício
  do serviço de infra.

Recursos da máquina (disco cheio derruba o Postgres e o MinIO):

```bash
df -h /            # uso de disco — acima de 90% é urgente
docker system df   # espaço usado por imagens/volumes
free -h            # memória
```

## 4. Logs

```bash
docker logs --tail 200 nextjs-app
docker logs --tail 200 steel-worker
docker logs --tail 200 steel-db
docker logs --tail 200 steel-redis
docker logs --tail 200 steel-minio
# acompanhar ao vivo: acrescente -f  (Ctrl+C para sair)
```

O que procurar:

- `nextjs-app`: `ECONNREFUSED` (banco/Redis/MinIO fora), `ZodError` na
  subida (variável de ambiente faltando/errada no `.env`).
- `steel-worker`: `queue.worker.started` deve aparecer após cada reinício;
  `queue.job.failed` repetido indica um job quebrando.
- `steel-db`: `No space left on device`, `database system is shut down`.

No Axiom, filtre por `component = "Worker"` ou pelo nome do evento (ex.:
`queue.status_collect.failed`, `queue.database_backup.full_failed`).

## 5. Backups (checagem diária recomendada)

O backup FULL roda às 03:15 (horário de Brasília). No Axiom, procure:

- `queue.database_backup.full_completed` — backup local OK.
- `queue.database_backup.offsite_completed` — cópia fora do servidor OK.
- `queue.database_backup.offsite_not_configured` — **não há cópia offsite**;
  avise o responsável (ver [restore](./restore-backup.md#configurar-a-cópia-offsite)).
- `..._failed` — falha; abra incidente.
