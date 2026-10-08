# 0024 — Integrações (Slack, GitHub, GitLab) ficam no nível do workspace

- **Status:** Aceita
- **Data:** 2026-10-08
- **Decisores:** product owner (pedido "Ajustes > Integrações fazer globalmente integração com github, gitlab e slack") e a fatia settings-integrations

## Contexto

As integrações com Slack e GitHub nasceram dentro do ServiceDesk
(`sd_integrations`, aba Configurações > Integrações do módulo, só admin do
módulo). Com isso:

- o CRM, a Comunicação e os Steel Agents não tinham como avisar no Slack;
- a conexão (OAuth do Slack, token do GitHub) era configurada por quem
  administra o ServiceDesk, não por quem responde pelo workspace;
- não havia GitLab, e cada provedor novo ia repetir a mesma estrutura.

## Decisão

A conexão passa a ser **do workspace**: tabela `workspace_integrations`
(`WorkspaceIntegration`, tipos `SLACK`, `GITHUB`, `GITLAB`), configurada uma
vez em **Ajustes > Integrações** por OWNER/ADMIN e usada por todos os
módulos. Os módulos guardam só as próprias preferências dentro do `config`
da conexão (ex.: o canal por time e a abertura de chamado pelo Slack, no
bloco `servicedesk`).

- **Credenciais**: token e segredo do webhook cifrados com
  `CONNECTION_SECRETS`; nunca voltam em DTO, log ou resposta. Toda mudança é
  auditada (`auditMutation` entidade `workspace_integration`; a concessão
  OAuth do Slack em `auditAuth` `auth.oauth_grant.workspace_slack`).
- **Uma conexão viva por tipo**: conectar outro repositório/projeto aposenta
  o anterior (exclusão lógica, para os vínculos antigos continuarem no
  histórico dos chamados).
- **Slack**: regras "evento → canal" por módulo (catálogo em
  `src/lib/integrations/catalog.ts`); um evento pode ir a vários canais.
  Eventos do ServiceDesk podem mirar "o canal do time"; o canal por time
  (configurado no ServiceDesk) substitui o canal da regra. Entrega fora da
  requisição, na fila `workspace-integrations` (o ServiceDesk segue com o job
  `deliver-event` da fila dele).
- **GitHub e GitLab** têm o mesmo conjunto de recursos nos chamados (vincular
  issue/PR/MR, abrir issue, estado espelhado por webhook, reconciliação de
  hora em hora). GitLab aceita gitlab.com ou instância própria (só HTTPS e
  host público — o servidor manda o token para esse endereço) com token
  pessoal, de projeto ou de grupo.
- **Webhooks** públicos novos em `/api/integrations/{github,gitlab}/webhook`.
  O identificador do repositório só acha as conexões candidatas; vale a
  primeira cujo segredo verifica (HMAC no GitHub, `X-Gitlab-Token` no GitLab,
  sempre em tempo constante). Os caminhos do Slack
  (`/api/servicedesk/integrations/slack` e `/oauth/slack`) e o webhook antigo
  do GitHub continuam valendo — já estão cadastrados nos apps e repositórios.
- **Códigos de erro**: os `SD_INTEGRATION_*` existentes são reaproveitados
  (renomear quebraria clientes da API).

### Migração

`20261008161034_settings_integrations_workspace_level` é aditiva: cria a
tabela nova, **copia** as linhas de `sd_integrations` com os mesmos ids e só
re-aponta a chave estrangeira de `sd_integration_links`. O `config` é
copiado como está e convertido **na leitura**
(`parseWorkspaceSlackConfig`/`parseWorkspaceRepoConfig`): o canal padrão +
eventos escolhidos do formato antigo viram uma regra por evento; sem canal
padrão, as regras ficam "só canal do time", exatamente como o despachante
antigo se comportava. A próxima gravação salva o formato novo.

**Rollback** (manual, se for preciso voltar o código):

```sql
ALTER TABLE "sd_integration_links" DROP CONSTRAINT "sd_integration_links_integration_id_fkey";
DELETE FROM "sd_integration_links" l
 WHERE NOT EXISTS (SELECT 1 FROM "sd_integrations" s WHERE s.id = l.integration_id);
ALTER TABLE "sd_integration_links" ADD CONSTRAINT "sd_integration_links_integration_id_fkey"
  FOREIGN KEY ("integration_id") REFERENCES "sd_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP TABLE "workspace_integrations";
DROP TYPE "workspace_integration_kind";
DROP TYPE "workspace_integration_status";
```

Vínculos do GitLab e conexões criadas depois da migração se perdem no
rollback; os valores `GITLAB_*` ficam no enum (o Postgres não remove valor de
enum) sem efeito. `sd_integrations` fica intacta até uma migração futura a
remover.

## Consequências

- Todo módulo pode avisar no Slack chamando `notifyWorkspaceSlack` com uma
  chave do catálogo — novo evento é uma linha no catálogo e uma chamada.
- Quem administra só o ServiceDesk não conecta mais Slack/GitHub: pede ao
  OWNER/ADMIN. A aba do módulo mostra o estado e aponta para Ajustes.
- O texto das regras depende do catálogo: remover um evento dele descarta as
  regras correspondentes na leitura (sem erro).
- Pendente: proteção contra DNS rebinding no endereço do GitLab (hoje só
  hosts literais privados são recusados) e a remoção de `sd_integrations`.
