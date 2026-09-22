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

## Fatias e dono de cada arquivo (construção em paralelo)

| Fatia | Dono de |
| ----- | ------- |
| config | `sd-settings`, `sd-department`, `sd-category`, `sd-classification`, `sd-priority` (impacto, urgência, prioridade, matriz, severidade), `sd-phase` (+ transições), `sd-calendar`, `sd-sla-policy`, `sd-escalation-rule`, `sd-automation-rule`, `sd-custom-field`, `sd-ticket-template`, `sd-canned-response`, `sd-part`, `sd-seed.service.ts`, `sd-access.ts`, tela `/settings` |
| tickets | `sd-ticket`, `sd-ticket-participant`, `sd-ticket-event`, `sd-ticket-escalation` (service manual + automático), `sd-saved-view`, `src/lib/servicedesk/{sla,conditions,ticket-code,realtime}.ts`, SSE `servicedesk/events`, motor de automação, fila `servicedesk-sla` |
| directory | `sd-customer`, `sd-contact`, `sd-config-item` (+ tipos), `src/lib/servicedesk/{document,viacep}.ts`, telas de cadastro |
| knowledge | `sd-kb-article`, `sd-kb-comment`, editor Plate, telas `/knowledge` |
| ticket-ui | quadros, filtros, visões salvas, tela do chamado (casca + cabeçalho + campos), início |
| ticket-tabs | `sd-ticket-message`, `-attachment`, `-task`, `-cost`, `-part`, `-approval`, `-signature`, abas do chamado (a de Escalonamento usa o service da fatia tickets), página pública de aprovação |
| whatsapp-ai | conexão WhatsApp do módulo, webhook → chamado, aba WhatsApp, `sd-ai*` (copiloto, pré-atendimento, triagem) |
| dashboards-portal | fontes do dashboard, seeds Analítico/KPIs, modo TV, portal do solicitante |
