# Excluir um workspace

**Quando usar:** cliente encerrou o contrato, pediu a exclusão dos dados
(LGPD) ou o workspace foi criado por engano.

> A exclusão é **definitiva**. O único caminho de volta é restaurar o backup
> que o próprio processo gera — e ele **não inclui arquivos** (mídias do
> WhatsApp, anexos, capas). Se o cliente só está inadimplente, **suspenda**
> em vez de excluir.

## Pelo painel (caminho normal)

1. Entre em `https://<domínio>/admin/workspaces`, abra o workspace e confira
   nome, slug e ID.
2. Em **Ciclo de vida → Excluir workspace**, escreva o motivo (fica na
   auditoria) e digite o **slug** exatamente.
3. Acompanhe o progresso no próprio detalhe (ou em `/admin/backups`):
   `Na fila do worker` → `Fazendo backup do workspace` → `Apagando dados` →
   `Apagando arquivos` → `Concluída`. Os membros já ficam bloqueados desde o
   passo 1.
4. Ao concluir:
   - Anote o **ID do backup** mostrado na operação (retenção de 90 dias).
   - Se aparecer **“Cancele no AbacatePay”**, cancele essas assinaturas no
     painel do AbacatePay — o Steel não tem API de cancelamento.
   - Se aparecer **“Arquivos não apagados por completo”**, veja
     [limpeza manual de arquivos](#limpeza-manual-de-arquivos).

### Se falhar

| Passo onde parou | O que aconteceu | O que fazer |
| ---------------- | --------------- | ----------- |
| Na fila / backup | nada foi apagado; o workspace voltou ao status anterior | veja o erro na operação e os logs do worker (`queue.admin_operation.workspace_delete_failed`); resolva (MinIO fora? [health check](./health-check.md)) e peça a exclusão de novo |
| Apagando dados | a transação desfez tudo; o workspace voltou ao status anterior | idem; se repetir, acione o engenheiro com o erro |
| Apagando arquivos | **dados já apagados**; operação `Concluída` com aviso | [limpeza manual de arquivos](#limpeza-manual-de-arquivos) |

Operação parada em “Na fila” por muito tempo = worker parado:
[reinicie o `steel-worker`](./restart-service.md). A operação continua de onde
estava (backup já concluído é reaproveitado).

## Limpeza manual de arquivos

Os arquivos de um workspace ficam no MinIO sob o prefixo `<workspaceId>/`
nos buckets `projects-covers`, `crm-scheduled-posts`,
`crm-social-publish-tmp`, `whatsapp-media` e `whatsapp-ai-knowledge`. Pelo
console do MinIO (`http://127.0.0.1:9003`, via túnel SSH) ou com o `mc`:

```bash
docker run --rm --network steel_default --entrypoint sh minio/mc -c \
  'mc alias set s http://steel-minio:9000 "$MINIO_USER" "$MINIO_PASSWORD" && \
   for b in projects-covers crm-scheduled-posts crm-social-publish-tmp whatsapp-media whatsapp-ai-knowledge; do \
     mc rm --recursive --force "s/$b/<workspaceId>/"; done'
```

(`MINIO_USER`/`MINIO_PASSWORD` do `.env`.) Anexos do assistente de IA
(`crm-ai-attachments`) usam o ID da conversa, não do workspace — a operação
já os apaga pela lista gravada antes do purge.

## Desfazer (restaurar o workspace excluído)

Em `/admin/backups`, filtre **Por workspace**, ache o backup (marcado
“excluído”) e use **Restaurar** digitando o slug. Funciona enquanto o slug
não tiver sido usado por outro workspace e os usuários-membros ainda
existirem. Detalhes em [restaurar um backup](./restore-backup.md#restore-de-um-workspace).
