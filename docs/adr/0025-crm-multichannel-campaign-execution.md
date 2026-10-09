# 0025 — Campanha multicanal: e-mail + WhatsApp opcional, sem grafo de etapas

- **Status:** Aceita
- **Data:** 2026-10-09
- **Decisores:** product owner ("montar a landing ou forms, pegar os links, montar os visuais e textos e vincular. O WhatsApp fica sendo à parte e faz apenas integração (ativável)") e a fatia crm-multichannel-campaigns

## Contexto

O CRM já tinha campanhas de e-mail simples (`CrmEmailCampaign`, envio
síncrono no request ou pelo tick `crm-scheduled-send`), landing pages e
formulários, e a Comunicação já tinha transmissões de WhatsApp
(`whatsapp-broadcast`). Faltava ligar tudo numa campanha só: o contato
recebe o e-mail (e, se a empresa quiser, o WhatsApp), clica, cai na landing
page ou no formulário e vira lead — e o dono da campanha vê o funil inteiro.

A primeira proposta era um construtor de sequências com etapas, esperas e
condições (abriu/clicou/respondeu). O product owner simplificou: o valor
está no ciclo **destino → conteúdo → público → envio → resultado**, e o
WhatsApp entra só como integração opcional. O workflow do CRM também tem um
atraso que não pausa de verdade acima de 1 minuto — mais um motivo para não
depender dele.

## Decisão

Uma campanha (`CrmCampaign`) é um **assistente de 4 passos** — Destino,
Conteúdo, Público, Revisar e enviar — com **um e-mail** e, se ligado, **uma
mensagem de WhatsApp** enviada no mesmo horário ou N horas depois. Não há
sequência nem ramificação.

- **Destino e links.** A campanha aponta para uma landing page ou um
  formulário do CRM. O link de cada contato é um redirecionador assinado
  (`/api/crm/campaigns/c/<token>`, HMAC por destinatário + canal) que marca o
  clique e redireciona para o destino com `utm_source=email|whatsapp`,
  `utm_medium`, `utm_campaign=<slug>` e `stc=<token>`. A página pública lê
  esses parâmetros e os manda junto com a visita (landing) ou o envio
  (formulário); a atribuição grava `CrmCampaignConversion` (idempotente por
  visita/envio). Link repassado sem token ainda conta pela `utm_campaign`.
- **Público.** Listas de e-mail, todas as pessoas e leads por etapa,
  deduplicados por pessoa/lead/e-mail. O snapshot (`CrmCampaignRecipient`) é
  tirado no lançamento, com o estado de cada canal: sem endereço ou
  descadastrado vira `NONE`/`SKIPPED` e nunca recebe. A base legal (LGPD) de
  cada canal e a confirmação de quem lançou ficam gravadas na campanha.
- **Execução** — fila própria `crm-campaigns`:
  - `dispatch` (atrasado até o início de cada canal: `startAt` para o
    e-mail, `startAt + whatsappDelayHours` para o WhatsApp) enfileira lotes
    de `send` com espaçamento por canal/provedor;
  - `send` **reivindica** a linha (`PENDING → SENDING` condicional) antes
    de enviar — só quem reivindicou envia, então job repetido, tick e
    retomada nunca duplicam; limite de taxa devolve a linha para `PENDING` e
    o job tenta de novo com backoff;
  - `tick` (a cada 5 min) é a rede de segurança: inicia agendadas, refaz o
    dispatch de quem tem pendência, libera linhas presas em `SENDING` e
    fecha campanhas sem pendência (aviso ao dono, `CRM_CAMPAIGN_FINISHED`).
  - **Janela de envio** em `America/Sao_Paulo` (hora início/fim, dias úteis):
    fora dela o dispatch reagenda para a próxima abertura.
  - **Pausar/retomar/cancelar**: o `send` relê o status; pausada deixa a linha
    pendente, cancelada vira `SKIPPED`. Tudo auditado.
- **Regras por provedor de WhatsApp.** Meta Cloud API só aceita template
  aprovado (fora da janela de 24 h só template é permitido) com mapeamento de
  variáveis — nome, primeiro nome, link da campanha, código do link para
  botão de URL dinâmico, ou texto fixo. Z-API aceita texto (com `{nome}` e
  `{link}`) e mídia opcional. Teto diário por conexão Meta (tier 1 = 1.000
  contatos/24 h) adia o excedente para o próximo tick.
- **Rastreamento.** E-mail: pixel de abertura, clique pelo redirecionador,
  descadastro pelo link do rodapé (mesma tabela de opt-out LGPD do CRM) e, com
  `RESEND_WEBHOOK_SECRET`, entregue/bounce/reclamação pelo webhook do Resend
  (`/api/crm/campaigns/resend-webhook`, assinatura Svix; a reclamação marca o
  descadastro no funil do destinatário).
  WhatsApp: entregue/lida pelos webhooks de status já existentes; resposta
  marca o destinatário, liga a conversa da Comunicação ao contato da campanha
  e registra uma atividade na pessoa do CRM. `SAIR` continua descadastrando
  pelo fluxo da Comunicação e é rechecado no envio.
- **Conteúdo do e-mail** passa por `renderCampaignEmail(templateId, contato)`
  (`src/lib/crm-campaign/email-renderer.ts`), que delega à API de render do
  editor visual de e-mail (`crm-email-builder.service`): o template (do editor
  ou HTML livre), a variável `{{campaign_link}}` com o link rastreado do
  destinatário e o rodapé de descadastro LGPD com o link dele. A campanha só
  acrescenta o pré-cabeçalho e o pixel de abertura.

## Consequências

- Uma campanha cabe numa tela por passo e o resultado mostra o funil de cada
  canal até a conversão no destino, sem o usuário montar fluxo.
- A idempotência vem do banco, não do `jobId`: qualquer job pode ser
  reenfileirado sem risco de envio duplo.
- Sequências com várias mensagens e condições (abriu/clicou/respondeu)
  ficam para depois; o modelo por destinatário + canal comporta novos
  canais/passos sem refazer a execução.
- A entrega de e-mail (delivered/bounce) depende do webhook do Resend estar
  configurado; sem ele o funil de e-mail vai de "enviado" direto para
  "aberto".
- As campanhas de e-mail antigas (`CrmEmailCampaign`) continuam como estão,
  agora no menu como **E-mail avulso**.
