# LGPD — descadastro (opt-out) de mensagens de marketing

Campanhas de e-mail do CRM e transmissões do WhatsApp são comunicação de
marketing: o titular pode sair a qualquer momento, sem login, e a exclusão
vale para **todas** as campanhas/transmissões futuras do workspace. Mensagens
transacionais (login, OTP, redefinição de senha, convites, avisos de conta)
**não** passam por essas regras.

## E-mail (campanhas do CRM)

- **Link em todo e-mail de campanha.** `CrmEmailCampaignService.send` anexa um
  rodapé com o link `/unsubscribe/<token>` e os cabeçalhos
  `List-Unsubscribe: <…/api/crm/unsubscribe/<token>>` e
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058).
- **Token.** HMAC-SHA256 do id do destinatário (`src/lib/crm-email-unsubscribe.ts`),
  assinado com `BETTER_AUTH_SECRET` e separação de domínio. Não expira e não
  exige sessão. Trocar `BETTER_AUTH_SECRET` invalida os links já enviados.
  As URLs usam `BETTER_AUTH_URL`, que precisa ser a URL pública.
- **Confirmação.** O `GET` da página só mostra o endereço; o descadastro exige
  o clique (`POST`), para que scanners de link não descadastrem ninguém. O
  `POST` one-click do provedor (`List-Unsubscribe=One-Click`) descadastra
  direto. As duas rotas estão em `PUBLIC_ROUTES` (`proxy.ts`) e exigem o
  módulo CRM habilitado na workspace do token.
- **Registro.** Tabela `crm_email_opt_outs` (workspace + e-mail em minúsculas,
  pessoa vinculada, campanha de origem, `source` = `LINK` ou `ONE_CLICK`,
  `created_at`). O primeiro descadastro prevalece. Auditoria:
  `audit.mutation.crm_email_opt_out.opt_out` (sem o e-mail no log).
- **Exclusão.** Feita na montagem dos destinatários (endereço **ou** pessoa
  vinculada) e revalidada no envio — quem saiu entre a criação e o disparo
  fica como `SKIPPED`. A UI só reflete (badge "Descadastrado", contagens).
- **Reinscrição.** Não há reinscrição pela interface: se o titular pedir para
  voltar a receber, remova o registro em `crm_email_opt_outs` mediante o
  pedido documentado.

## WhatsApp (transmissões)

- **Palavra-chave.** Uma mensagem recebida que seja **exatamente** `SAIR`,
  `PARAR`, `STOP` ou `DESCADASTRAR` (sem diferenciar maiúsculas, acentos e
  pontuação nas pontas) descadastra o contato das transmissões e envia uma
  confirmação na conversa; a IA não responde a essa mensagem.
  `CANCELAR` fica de fora de propósito: é a resposta natural a um lembrete de
  consulta (transmissões importadas por planilha).
- **Registro.** `whatsapp_contacts.broadcast_opted_out_at` e
  `broadcast_opt_out_source` (`KEYWORD` ou `ADMIN`). Auditoria:
  `audit.mutation.whatsapp_contact.opt_out` / `opt_in`.
- **Exclusão.** Filtrada na query ao criar a lista de transmissão e na
  importação por planilha; ao iniciar a lista e no processor de envio, quem
  saiu depois vira `SKIPPED`. Conversas individuais não são afetadas.
- **Admin.** Em Contatos, OWNER/ADMIN podem descadastrar um contato (ex.:
  pedido por telefone) — `PUT /api/workspaces/:id/whatsapp/contacts/:contactId/broadcast-opt-out`.

### Regra de reinscrição (re-subscribe)

Reinscrever um contato descadastrado **só é permitido a pedido explícito do
próprio contato** (por exemplo, ele escreveu pedindo para voltar a receber).
O admin não pode desfazer um "SAIR" por iniciativa própria nem por pedido de
terceiros.

- Somente OWNER/ADMIN (`assertModulePrivileged`, módulo Comunicação); o botão
  nem aparece para os demais membros.
- A API exige `contactRequested: true` (`UpdateWhatsAppContactBroadcastOptOutSchema`);
  sem isso responde `VALIDATION_ERROR`. Na UI, o admin precisa marcar "O
  contato pediu explicitamente para voltar a receber".
- O evento `opt_in` é auditado com quem reinscreveu e a data/origem do
  descadastro anterior. Guarde a evidência do pedido (a própria conversa no
  WhatsApp) — ela é a base legal da reinscrição.
