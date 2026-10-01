# ServiceDesk — contrato do domínio

Decisão de arquitetura: [ADR 0008](../adr/0008-servicedesk-itil-configurable-engine.md).
Modelos: bloco `ServiceDesk` no fim de `prisma/schema.prisma` (tabelas `sd_*`).

## Convenções

- Prefixo `Sd` / `sd-` em tudo: `src/schemas/sd-<x>.schema.ts`,
  `src/services/sd-<x>.service.ts`, `src/repositories/sd-<x>.repository.ts`,
  `src/mappers/sd-<x>.mapper.ts`, `types/sd-<x>.d.ts`,
  `src/lib/servicedesk/*` (libs puras: SLA, condições, CPF/CNPJ, ViaCEP…),
  `src/hooks/use-sd-<x>.ts`, UI em `app/_components/servicedesk/**`.
- API autenticada: `app/api/workspaces/[id]/servicedesk/**` (mesmo padrão de
  `crm/*`: `withAxiom` → sessão → rate limit → `requireConsent` nas mutações →
  Zod → service → `successResponse`/`handleError`). Públicas (sem sessão, por
  token): `app/api/servicedesk/**` (ex.: aprovação por e-mail).
- UI: `app/(private)/[workspace-slug]/servicedesk/**`.
- Autorização **no service**: `assertModuleMember(actor, ws, 'SERVICE_DESK',
  { resource: 'sd-…', action })` + `SdAccess` (agente × solicitante) de
  `src/services/sd-access.ts`.
- Mutação relevante de chamado ⇒ `SdTicketEvent` (rastreabilidade) +
  `auditMutation` (entity `sd_ticket`, …). Dados pessoais (cliente, contato,
  assinatura) são LGPD-sensíveis: auditar, nunca logar o conteúdo.
- Erros: códigos `SD_*` em `src/errors/codes.ts` (factories `sd*` em
  `app-error.ts`). Não invente código inline.
- Strings de UI em pt-BR. Cobertura ≥ 95% nas 4 métricas para services,
  repositories, mappers, schemas e `src/lib/queue/processors`.

## Papéis

| Quem | Como é definido | O que faz |
| ---- | --------------- | --------- |
| Admin do módulo | OWNER/ADMIN do workspace (ou perfil com `sd-settings`) | configura tudo |
| Agente | membro com ≥ 1 `SdDepartmentMember` | fila, kanban, atende, vê todos os chamados (líder: supervisiona o time) |
| Solicitante | membro com acesso ao módulo e sem departamento | portal: abre chamado, conversa, acompanha, assina, avalia (CSAT), lê KB `PORTAL` |

## Entidades e regras

- **Chamado** (`SdTicket`): número sequencial por workspace
  (`SdSettings.nextTicketNumber`, incremento atômico), exibido como
  `<prefixo>-<número>` (`ticketPrefixes`, padrão INC/REQ/CHG/PRB). Campos:
  título, tipo, descrição (HTML sanitizado), canal, fase (+ % snapshot),
  impacto, urgência, prioridade (matriz ou manual), severidade, categoria >
  subcategoria > serviço, classificação, classificação da solução, solução,
  cliente, empresa, contato, CI, departamento, responsável, solicitante,
  participantes, pai/filhos, tags, campos customizados, SLA, campos de
  mudança e de problema, IA (resumo/triagem), CSAT.
- **Abertura**: aplica o modelo → matriz de prioridade → roteamento
  (serviço/subcategoria/categoria → departamento, senão o padrão) → fase
  inicial do tipo → política de SLA (condições por `position`, senão a do
  catálogo, senão a padrão) → prazos → round-robin (se ligado) → automações
  `TICKET_CREATED` → evento `ticket.created`.
- **Mudança de fase**: valida transição (se houver transições para o tipo),
  `requiredFields`, `requiresApproval` (aprovação APPROVED vigente),
  RESOLVED exige solução/classificação da solução se
  `requireSolutionOnResolve`, CLOSED exige assinatura se
  `requireSignatureOnClose`. Entrar em fase `pausesSla` pausa o relógio;
  sair retoma (soma minutos úteis pausados aos prazos). RESOLVED carimba
  `resolvedAt`; CLOSED/CANCELED carimba `closedAt`. Primeira mensagem
  pública de agente carimba `firstRespondedAt`.
- **SLA**: minutos úteis sobre `SdBusinessCalendar` (fuso, expediente por
  dia, feriados, 24×7). "Em risco" a partir de `slaAtRiskPercent`.
- **Escalonamento**: manual (funcional = outro departamento; hierárquico =
  líder / nível +1) ou automático por `SdEscalationRule` no tick do worker.
- **Automação**: `SdAutomationRule` (evento → condições → ações), avaliadas
  por `position`, com `stopProcessing`. Condições: `{field, operator, value}`
  com operadores `equals | not_equals | in | not_in | contains | is_empty |
  is_not_empty | gt | lt`.
- **Aprovação**: e-mail com link público `/servicedesk/approval/<token>`
  (token aleatório, guardado como SHA-256, expira), aprova/reprova com
  comentário; resposta vira evento + notificação + automação
  `APPROVAL_RESPONDED`.
- **Assinatura**: canvas → PNG no MinIO (bucket `servicedesk`), SHA-256 do PNG
  e de um snapshot do chamado.
- **Anexos**: MinIO bucket `servicedesk`, chave
  `<workspaceId>/tickets/<ticketId>/<cuid>-<nome>`; imagem, vídeo, áudio,
  documento; limite 25 MB.
- **Cliente/Empresa** (`SdCustomer`): nome, fantasia, PF/PJ, CPF/CNPJ
  (dígitos, validado, único por workspace entre não excluídos), e-mail,
  telefone, WhatsApp, endereço completo com ViaCEP. **Contato**: nome,
  cargo, e-mail, telefone, WhatsApp, uma ou mais empresas/clientes, usuário
  da plataforma opcional (chat interno/portal).
- **Departamentos**: dois níveis (departamento > sub-departamento); usuário
  em vários, com flag de líder.
- **Base de conhecimento**: port da Wiki do Nexo (Plate), árvore de artigos,
  rascunho/publicado, interno/portal, categoria, tags, votos de utilidade,
  vínculo com chamado.
- **Dashboards**: motor do CRM com `module = SERVICE_DESK` e fontes
  `sd-tickets` etc.; padrões "Analítico" e "KPIs (TV)" semeados; modo TV em
  tela cheia com auto-refresh.

## Motor de chamados (contratos para as outras fatias)

API (`app/api/workspaces/[id]/servicedesk/…`, OpenAPI em
`src/openapi/paths/servicedesk-tickets.ts`): `tickets` (GET lista/kanban
com filtros, POST abrir), `tickets/summary`, `tickets/bulk`,
`tickets/[ticketId]` (GET/PATCH/DELETE — `ticketId` aceita id, número ou
`INC-000123`), `…/phase`, `…/parent`, `…/participants[/userId]`,
`…/events` (rastreabilidade), `…/escalations`, `saved-views[/viewId]` e o
SSE `events`. Hooks: `src/hooks/use-sd-tickets.ts`.

Para as fatias que mexem no chamado (mensagens, tarefas, aprovações,
assinaturas, WhatsApp/IA):

- **Rastreabilidade**: `recordSdTicketEvent(event | event[])`
  (`src/services/sd-ticket-event-recorder.ts`) — `{ workspaceId, ticketId,
  actorKind, actorUserId?, action, field?, fromValue?, toValue?, meta? }`;
  relações como `{ id, label }`. Nunca lança.
- **Tempo real**: `publishSdTicketEvent(workspaceId, event, audience)`
  (`src/lib/servicedesk/realtime.ts`). Evento `{ type, ticketId, number,
  at, actorId?, internal? }` com `type` ∈ `ticket.created | ticket.updated
  | ticket.phase_changed | ticket.assigned | ticket.deleted |
  ticket.escalated | ticket.sla | ticket.participants | ticket.message |
  ticket.task | ticket.cost | ticket.part | ticket.attachment |
  ticket.approval | ticket.signature`. `audience = { requesterId,
  participantIds, contactUserId }` decide quais solicitantes recebem;
  `internal: true` (nota interna, custo) só vai para agentes. O evento é um
  aviso: o cliente recarrega pelas rotas.
- **Automação**: `runSdAutomations(event, ticketId, { actorId })` /
  `fireSdAutomations(…)` (`src/services/sd-automation-engine.ts`) — ex.:
  `MESSAGE_RECEIVED`, `APPROVAL_RESPONDED`. As ações não disparam novas
  automações (sem laço).
- **Motor** (`SdTicketEngine`, `src/services/sd-ticket-engine.ts`, sem
  autorização): `resolveRef`, `markFirstResponse(ticketId)` (1ª mensagem
  pública de agente), `touchActivity(ticketId)`, `reopen(ticket, actor,
  config)` (resposta do solicitante com `reopenOnRequesterReply`),
  `changePhase`, `update`, `loadConfig`. Visibilidade:
  `canViewSdTicket(ctx, ticket)`. HTML rico: `sanitizeSdHtml` /
  `sdHtmlToText` (`src/lib/servicedesk/html.ts`).
- **SLA**: `src/lib/servicedesk/sla.ts` (`addBusinessMinutes`,
  `businessMinutesBetween`, `computeSlaState`, `parseSdCalendar`). O tick
  `servicedesk-sla` (1 min) marca risco/violação uma única vez, notifica
  (responsável + líderes), roda `SdEscalationRule` e as automações
  `SLA_AT_RISK`/`SLA_BREACHED` e fecha RESOLVED vencidos.

## Notificações (central do módulo)

Um único motor avisa todo mundo: `notifySdEvent({ workspaceId, event,
ticket, actorId?, audience?, payload })`
(`src/services/sd-notification.service.ts`). O **catálogo**
`src/config/servicedesk-notifications.ts` (`SD_NOTIFICATION_EVENTS`) é o
contrato — chave do evento, tipo da notificação in-app
(`Notification.kind`), público, canais oferecidos, canais ligados por padrão
e o flag `agentOnly`. Evento novo entra lá (e num grupo de
`SD_NOTIFICATION_GROUPS`, que é a ordem da tela); chave fora do catálogo
devolve `SD_NOTIFICATION_EVENT_UNKNOWN`.

O que o motor faz, em ordem: resolve o público pelo catálogo (`assignee`,
`participants`, `followers`, `requester`, `contact`, `departmentLeads`,
`mentioned`) → soma `payload.userIds` → tira o autor (`actorId`), os
excluídos e os duplicados → evento `agentOnly` só segue para quem atende
(nunca solicitante nem contato externo) → cada canal respeita
`SdNotificationPreference` (sem linha = padrão do catálogo) → entrega
**IN_APP** (`Notification`, aparece em `/[slug]/inbox`), **EMAIL** (React
Email, respeita `MAIL_DRY_RUN`) e **WHATSAPP** (só com conexão do
ServiceDesk `CONNECTED`; sem conexão silencia com log). Nunca lança: falha
de canal vira log e o resto segue; só erro de banco vira `err`.

- `audience: 'payload'` ignora o público do catálogo e usa apenas
  `payload.userIds` — é o caso da ação "notificar" das automações, do
  pedido de aprovação e da tarefa atribuída, em que quem dispara já
  escolheu os destinatários.
- Monte o `ticket` com `sdNotifyTicketOf(ticket, code)`
  (`src/lib/servicedesk/notify.ts`, puro — não puxa o service).
- **Seguir chamado** (`SdTicketFollower`): `SdTicketFollowerService`
  (list/follow/unfollow, sempre em nome de quem chamou, idempotente) e
  `GET|POST|DELETE .../servicedesk/tickets/[ticketId]/followers`. Quem segue
  entra no público `followers`.
- **Menções**: `SdTicketMessage.mentionedUserIds` (coluna nova) guarda os
  agentes citados com `@` no composer; o service filtra para agentes do
  workspace e dispara `ticket.mentioned`.
- **Preferências por usuário**: `SdNotificationService.get/update/
  restoreDefaults` e `GET|PUT|DELETE
  .../servicedesk/notification-preferences`; tela na aba "Notificações" de
  `/settings`. Não há visão de administrador — cada um configura a sua.
- **Resumo diário** (`digest.daily`, desligado por padrão): fila
  `servicedesk-digest` (de hora em hora; `SdDigestService.runTick` só envia
  aos workspaces cuja hora local é `SD_DIGEST_HOUR`, o que dá um envio por
  dia sem carimbo de controle — por isso a fila usa `attempts: 1`). Fila
  vazia não gera resumo.
- A antiga flag "enviar e-mail" das regras de escalonamento e da ação
  "notificar" das automações **não força mais e-mail**: o canal é a
  preferência de cada destinatário (o valor da regra vai para o log como
  `ruleEmail`).

## Rotas de UI

| Rota (`/[slug]/servicedesk/…`) | Tela |
| ------------------------------ | ---- |
| `/` | início (minha fila, KPIs rápidos, SLA em risco) |
| `/portal`, `/portal/new`, `/portal/tickets/[number]` | portal do solicitante (+ pré-atendimento IA) |
| `/tickets`, `/incidents`, `/requests`, `/changes`, `/problems` | quadro kanban / lista / tabela com filtros e visões salvas |
| `/tickets/[number]` | tela do chamado (abas: Histórico, WhatsApp, Tarefas, Custos, Aprovação, Peças, Itens filhos, Escalonamento, Rastreabilidade, Assinatura, Conhecimento) |
| `/customers`, `/companies`, `/contacts`, `/config-items` | cadastros |
| `/knowledge`, `/knowledge/[articleId]` | base de conhecimento |
| `/dashboards`, `/dashboards/[id]`, `/dashboards/[id]/tv` | painéis |
| `/settings` | configurações (abas) |
| `/servicedesk/approval/[token]` (pública, fora do workspace) | aprovar/reprovar |

Contrato compartilhado já pronto (fundação): `src/services/sd-access.ts`,
`src/schemas/sd-rule.schema.ts` (condições e ações das regras).

## Mapa do código por fatia

| Fatia | Arquivos |
| ----- | -------- |
| config | `sd-settings`, `sd-department`, `sd-category`, `sd-classification`, `sd-priority` (impacto, urgência, prioridade, matriz, severidade), `sd-phase` (+ transições), `sd-calendar`, `sd-sla-policy`, `sd-escalation-rule`, `sd-automation-rule`, `sd-custom-field`, `sd-ticket-template`, `sd-canned-response`, `sd-part`, `sd-seed.service.ts`, `sd-access.ts`, tela `/settings` |
| tickets | `sd-ticket`, `sd-ticket-participant`, `sd-ticket-event`, `sd-ticket-escalation` (service manual + automático), `sd-saved-view`, `src/lib/servicedesk/{sla,conditions,ticket-code,realtime}.ts`, SSE `servicedesk/events`, motor de automação, fila `servicedesk-sla` |
| directory | `sd-customer`, `sd-contact`, `sd-config-item` (+ tipos), `src/lib/servicedesk/{document,viacep}.ts`, telas de cadastro |
| knowledge | `sd-kb-article`, `sd-kb-comment`, editor Plate, telas `/knowledge` |
| ticket-ui | quadros, filtros, visões salvas, tela do chamado (casca + cabeçalho + campos), início |
| ticket-tabs | `sd-ticket-message`, `-attachment`, `-task`, `-cost`, `-part`, `-approval`, `-signature`, abas do chamado (a de Escalonamento usa o service da fatia tickets), página pública de aprovação |
| whatsapp-ai | conexão WhatsApp do módulo, webhook → chamado, aba WhatsApp, `sd-ai*` (copiloto, pré-atendimento, triagem) |
| notifications | `src/config/servicedesk-notifications.ts`, `sd-notification` (schema/mapper/repository/service = motor + preferências), `sd-ticket-follower.service.ts`, `sd-digest.service.ts`, `src/lib/servicedesk/notify.ts`, fila `servicedesk-digest`, aba "Notificações", botão Seguir, menções no composer |
| dashboards-portal | fontes do dashboard, seeds Analítico/KPIs, modo TV, portal do solicitante |
| monitoring | `sd-monitor-source`, `sd-monitor-alert`, `src/lib/servicedesk/{monitoring,monitor-fields}.ts`, entrada pública `servicedesk/monitoring/[token]`, aba Monitoramento das configurações, bloco de origem na tela do chamado |

## Operação

- **Ligar o módulo**: o admin global libera `SERVICE_DESK` no painel
  (`/admin/workspaces/[id]/module-access`). Isso dispara o seed ITIL
  (`SdSeedService`) e os dois dashboards padrão
  (`SdDashboardSeedService`) — ambos idempotentes. Para workspaces antigos:
  `pnpm seed:servicedesk`.
- **Primeiros passos no workspace**: Configurações > Departamentos (coloque
  os agentes num time — quem não está em nenhum vira solicitante) →
  Catálogo → SLA → Fluxos, se quiser mudar as fases. O resto já vem semeado.
- **Filas do worker**: `servicedesk-sla` (1 min: risco/violação,
  escalonamento, automações de SLA e fechamento automático de resolvidos),
  `servicedesk-ai` (triagem automática na abertura, quando ligada) e
  `servicedesk-digest` (de hora em hora; manda o resumo diário a quem optou,
  na hora local do workspace).
- **Notificações**: Configurações > Notificações é a tela de **cada
  usuário** (não é configuração do workspace). O canal WhatsApp só aparece
  quando existe conexão do ServiceDesk ativa. "Restaurar padrões" apaga as
  escolhas e volta ao catálogo.
- **WhatsApp**: Configurações > WhatsApp cria a conexão do módulo
  (`WhatsAppConnection.module = SERVICE_DESK`, separada da do zap) e aponta a
  ativa em `SdSettings.whatsappConnectionId`. O webhook já roteia mensagens
  para o chamado aberto da conversa, ou abre um novo (ou entrega ao
  pré-atendimento da IA, se ligado).
- **IA**: Configurações > IA liga copiloto, triagem e pré-atendimento. Usa o
  provedor e a cota do workspace (ADR 0007); sem chave ou com cota estourada,
  a interface explica em vez de falhar silenciosamente.
- **Monitoramento**: Configurações > Monitoramento cria a origem (Zabbix ou
  webhook genérico). O token da URL pública é sorteado na criação, **aparece
  uma única vez** e fica guardado só como SHA-256 (`SdMonitorSource.tokenHash`);
  perdeu, gere outro — o anterior deixa de valer na hora. No Zabbix: Alertas >
  Tipos de mídia > novo **Webhook** com a URL, método POST e o JSON das macros
  (`{EVENT.ID}`, `{EVENT.VALUE}`, `{EVENT.STATUS}`, `{EVENT.NAME}`,
  `{EVENT.SEVERITY}`, `{EVENT.DATE}`, `{EVENT.TIME}`, `{EVENT.TAGS}`,
  `{HOST.NAME}`, `{HOST.IP}`, `{ALERT.MESSAGE}` — a tela mostra o corpo pronto
  para copiar). Um webhook próprio pode mandar
  `{ externalId, status, severity, host, subject, body, tags, startedAt }`.
  A entrada deduplica por `(origem, externalId)`: o mesmo alerta reenviado
  atualiza a linha e não abre um segundo chamado. PROBLEM abre o chamado com os
  padrões da origem (tipo, departamento, categoria, cliente), prioridade pelo
  mapa severidade → prioridade, canal `API` e ator de sistema, casando o host
  com o item de configuração (nome, código ou IP). OK/RESOLVED fecha o alerta e,
  com `autoResolve`, move o chamado para a fase RESOLVED do tipo com a solução
  automática; se a fase exigir algo que o monitoramento não preenche (campos
  obrigatórios, aprovação, classificação da solução), o chamado recebe uma
  mensagem pública explicando em vez de ser encerrado. O mesmo alerta voltando
  dentro de `flappingWindowMinutes` reabre o chamado anterior.
- **Portal**: `/[slug]/servicedesk/portal`. Solicitante é todo membro com
  acesso ao módulo e sem departamento; o menu dele só mostra portal e base de
  conhecimento.
- **Modo TV**: `/[slug]/servicedesk/dashboards/[id]/tv` (tela cheia, atualiza
  sozinho; `?rotate=id1,id2&interval=60` alterna painéis).
