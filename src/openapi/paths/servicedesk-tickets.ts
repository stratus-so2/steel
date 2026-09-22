import { z } from 'zod'
import {
  CreateSdSavedViewSchema,
  UpdateSdSavedViewSchema,
} from '@/src/schemas/sd-saved-view.schema'
import {
  BulkUpdateSdTicketsSchema,
  CreateSdTicketSchema,
  MoveSdTicketPhaseSchema,
  SetSdTicketParentSchema,
  UpdateSdTicketSchema,
} from '@/src/schemas/sd-ticket.schema'
import { EscalateSdTicketSchema } from '@/src/schemas/sd-ticket-escalation.schema'
import { AddSdTicketParticipantSchema } from '@/src/schemas/sd-ticket-participant.schema'
import type { ErrorEntry, OpenApiRegistry, RouteConfig } from '../registry'
import {
  SdBulkUpdateResultDTO,
  SdSavedViewDTO,
  SdTicketDTO,
  SdTicketEscalationDTO,
  SdTicketEventPageDTO,
  SdTicketKanbanDTO,
  SdTicketPageDTO,
  SdTicketRealtimeEventDTO,
  SdTicketSummaryDTO,
  SdUserSummaryDTO,
} from '../schemas/servicedesk-tickets'

/**
 * ServiceDesk — chamados (`app/api/workspaces/[id]/servicedesk/tickets/**`),
 * visões salvas e o SSE `.../servicedesk/events`. Autorização no service:
 * membro + módulo SERVICE_DESK + permissão `sd-tickets` e o papel de
 * agente × solicitante (`SdAccess`).
 */

const TICKETS = 'ServiceDesk · Chamados' as const
const VIEWS = 'ServiceDesk · Visões salvas' as const

const base = '/workspaces/{id}/servicedesk'
const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`INC-000123`).',
}

function access(action: string, extra = ''): string {
  return `Acesso: sessão + membro com o módulo **ServiceDesk** habilitado e a permissão \`sd-tickets\` × \`${action}\` (OWNER/ADMIN sempre passam).${extra ? ` ${extra}` : ''}`
}

const ACCESS_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]
const AGENT_ERRORS: ErrorEntry[] = [
  ...ACCESS_ERRORS,
  {
    code: 'SD_NOT_AGENT',
    when: 'Solicitante (sem departamento) tentou uma ação de agente',
  },
]
const TICKET_ERRORS: ErrorEntry[] = [
  'SD_TICKET_NOT_FOUND',
  {
    code: 'SD_TICKET_FORBIDDEN',
    when: 'Solicitante sem vínculo com o chamado',
  },
]
const REF_ERRORS: ErrorEntry[] = [
  'SD_CATEGORY_NOT_FOUND',
  'SD_CATEGORY_LEVEL_INVALID',
  'SD_DEPARTMENT_NOT_FOUND',
  'SD_CUSTOMER_NOT_FOUND',
  'SD_CONTACT_NOT_FOUND',
  'SD_CONFIG_ITEM_NOT_FOUND',
  {
    code: 'SD_CONFIG_NOT_FOUND',
    when: 'Impacto/urgência/prioridade/severidade/classificação/modelo de outro workspace ou inexistente',
  },
  'SD_CUSTOM_FIELD_INVALID',
]
const PHASE_ERRORS: ErrorEntry[] = [
  'SD_PHASE_NOT_FOUND',
  'SD_PHASE_TRANSITION_NOT_ALLOWED',
  'SD_PHASE_REQUIREMENTS_UNMET',
  'SD_APPROVAL_REQUIRED',
  'SD_SIGNATURE_REQUIRED',
]

const LIST_QUERY = {
  type: 'object',
  properties: {
    view: {
      type: 'string',
      enum: ['list', 'kanban'],
      description: '`kanban` devolve colunas por fase (exige `type`).',
    },
    type: {
      type: 'string',
      enum: ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'],
    },
    types: { type: 'string', description: 'CSV de tipos.' },
    phaseIds: { type: 'string', description: 'CSV (ou chave repetida).' },
    phaseCategories: {
      type: 'string',
      description:
        'CSV: NEW, IN_PROGRESS, WAITING, RESOLVED, CLOSED, CANCELED.',
    },
    priorityIds: { type: 'string' },
    severityIds: { type: 'string' },
    impactIds: { type: 'string' },
    urgencyIds: { type: 'string' },
    departmentIds: { type: 'string' },
    assigneeIds: {
      type: 'string',
      description: 'CSV de ids; aceita `me` e `unassigned`.',
    },
    requesterId: { type: 'string', description: 'Id ou `me`.' },
    participantId: {
      type: 'string',
      description: 'Participante: id de usuário ou `me`.',
    },
    customerId: { type: 'string' },
    companyId: { type: 'string' },
    contactId: { type: 'string' },
    configItemId: { type: 'string' },
    categoryId: { type: 'string' },
    subcategoryId: { type: 'string' },
    serviceId: { type: 'string' },
    classificationId: { type: 'string' },
    channel: { type: 'string' },
    tags: { type: 'string', description: 'CSV — casa se tiver qualquer uma.' },
    sla: { type: 'string', enum: ['at_risk', 'breached'] },
    createdFrom: { type: 'string', format: 'date-time' },
    createdTo: { type: 'string', format: 'date-time' },
    dueFrom: {
      type: 'string',
      format: 'date-time',
      description: 'Prazo de resolução.',
    },
    dueTo: { type: 'string', format: 'date-time' },
    parentId: {
      type: 'string',
      description: 'Id do pai (itens filhos) ou `none`.',
    },
    q: {
      type: 'string',
      description:
        'Busca em título/descrição e pelo número/código (`INC-000123`).',
    },
    includeClosed: {
      type: 'boolean',
      description:
        'Inclui RESOLVED/CLOSED/CANCELED (padrão `false`; o kanban sempre inclui).',
    },
    sort: {
      type: 'string',
      enum: [
        'createdAt',
        'updatedAt',
        'lastActivityAt',
        'number',
        'title',
        'priority',
        'resolutionDueAt',
        'firstResponseDueAt',
      ],
    },
    order: { type: 'string', enum: ['asc', 'desc'] },
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 200 },
    cursor: {
      type: 'string',
      description: 'Id do último item (tem precedência sobre `page`).',
    },
    columnLimit: {
      type: 'integer',
      minimum: 1,
      maximum: 200,
      description: 'Kanban: itens por coluna.',
    },
  },
}

const ticketRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${base}/tickets`,
    tags: [TICKETS],
    summary: 'Listar chamados (lista ou kanban)',
    description: `Lista paginada (página ou cursor) com filtros; \`view=kanban\` devolve uma coluna por fase ativa do \`type\` com contagem e os primeiros \`columnLimit\` itens. Solicitantes veem só os chamados em que são solicitante, participante ou contato. O \`sla\` de cada item é calculado no momento da resposta. ${access('VIEW')}`,
    query: LIST_QUERY,
    responses: {
      200: {
        description: '`SdTicketPage` (lista) ou `SdTicketKanban` (kanban).',
        schema: z.union([SdTicketPageDTO, SdTicketKanbanDTO]),
      },
    },
    errors: [
      ...ACCESS_ERRORS,
      { code: 'VALIDATION_ERROR', when: 'Query inválida ou kanban sem `type`' },
    ],
  },
  {
    method: 'post',
    path: `${base}/tickets`,
    tags: [TICKETS],
    summary: 'Abrir chamado',
    description: `Aplica o modelo → matriz impacto × urgência (senão a prioridade padrão) → roteamento (serviço/subcategoria/categoria → departamento, senão o padrão) → fase inicial → política de SLA (condições por posição, senão a do catálogo, senão a padrão) → prazos em minutos úteis → round-robin (se ligado) → automações \`TICKET_CREATED\`. Número sequencial atômico por workspace. Descrição HTML sanitizada. **Solicitante** (portal): canal \`PORTAL\`, só tipos de \`portalTicketTypes\`, campos limitados (tipo, título, descrição, modelo/catálogo visíveis no portal, urgência, CI, campos customizados). Auditado. ${access('CREATE')}`,
    consent: true,
    body: CreateSdTicketSchema,
    responses: { 201: { description: 'Chamado aberto.', schema: SdTicketDTO } },
    errors: [
      ...ACCESS_ERRORS,
      ...REF_ERRORS,
      { code: 'SD_PHASE_NOT_FOUND', when: 'O tipo não tem fase inicial ativa' },
      'SD_PORTAL_DISABLED',
      { code: 'SD_TICKET_FORBIDDEN', when: 'Tipo não permitido no portal' },
    ],
  },
  {
    method: 'get',
    path: `${base}/tickets/summary`,
    tags: [TICKETS],
    summary: 'Resumo para o início',
    description: `Contagens por categoria de fase, minha fila aberta, sem responsável, SLA em risco/violado e criados hoje (fuso America/Sao_Paulo). Solicitante: só os próprios. ${access('VIEW')}`,
    responses: { 200: { description: 'Resumo.', schema: SdTicketSummaryDTO } },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'post',
    path: `${base}/tickets/bulk`,
    tags: [TICKETS],
    summary: 'Alterar chamados em massa',
    description: `Responsável, departamento, prioridade e/ou fase para até 200 chamados (regras de fase aplicadas a cada um). Falhas individuais voltam em \`failed\` sem abortar os demais. Só agentes. ${access('EDIT')}`,
    consent: true,
    body: BulkUpdateSdTicketsSchema,
    responses: {
      200: { description: 'Resultado.', schema: SdBulkUpdateResultDTO },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: `${base}/tickets/{ticketId}`,
    tags: [TICKETS],
    summary: 'Detalhar chamado',
    description: `Por id, número ou código. ${access('VIEW')}`,
    params: TICKET_PARAM,
    responses: { 200: { description: 'Chamado.', schema: SdTicketDTO } },
    errors: [...ACCESS_ERRORS, ...TICKET_ERRORS],
  },
  {
    method: 'patch',
    path: `${base}/tickets/{ticketId}`,
    tags: [TICKETS],
    summary: 'Atualizar chamado',
    description: `Campos do chamado (a fase muda por \`POST .../phase\`). Impacto/urgência sem prioridade recalculam pela matriz; nova prioridade recalcula política e prazos de SLA. Cada campo alterado vira evento de rastreabilidade; troca de responsável notifica. Chamado fechado/cancelado não aceita alterações. **Solicitante**: só título, descrição e avaliação (CSAT, após resolver). Dispara automações \`TICKET_UPDATED\`. ${access('EDIT')}`,
    consent: true,
    params: TICKET_PARAM,
    body: UpdateSdTicketSchema,
    responses: {
      200: { description: 'Chamado atualizado.', schema: SdTicketDTO },
    },
    errors: [
      ...ACCESS_ERRORS,
      ...TICKET_ERRORS,
      ...REF_ERRORS,
      'SD_TICKET_CLOSED',
    ],
  },
  {
    method: 'delete',
    path: `${base}/tickets/{ticketId}`,
    tags: [TICKETS],
    summary: 'Excluir chamado',
    description: `Exclusão lógica, só administradores do ServiceDesk. Auditado. ${access('DELETE')}`,
    consent: true,
    params: TICKET_PARAM,
    responses: { 200: { description: 'Excluído.', schema: null } },
    errors: [...ACCESS_ERRORS, ...TICKET_ERRORS],
  },
  {
    method: 'post',
    path: `${base}/tickets/{ticketId}/phase`,
    tags: [TICKETS],
    summary: 'Mudar fase',
    description: `Valida a transição (se houver transições para o tipo, e \`allowedDepartmentIds\`), \`requiredFields\`, \`requiresApproval\` (aprovação APPROVED vigente), solução/classificação ao resolver (\`requireSolutionOnResolve\`) e assinatura ao fechar (\`requireSignatureOnClose\`). Fase \`pausesSla\` pausa o SLA; sair soma os minutos úteis pausados aos prazos. Carimba \`resolvedAt\`/\`closedAt\`; voltar de RESOLVED/CLOSED reabre (\`reopenCount\`). Dispara \`PHASE_CHANGED\`. Só agentes. ${access('EDIT')}`,
    consent: true,
    params: TICKET_PARAM,
    body: MoveSdTicketPhaseSchema,
    responses: {
      200: { description: 'Chamado na nova fase.', schema: SdTicketDTO },
    },
    errors: [...AGENT_ERRORS, ...TICKET_ERRORS, ...PHASE_ERRORS],
  },
  {
    method: 'patch',
    path: `${base}/tickets/{ticketId}/parent`,
    tags: [TICKETS],
    summary: 'Definir item pai',
    description: `Liga (ou desliga com \`null\`) o chamado a um pai — ex.: incidentes de um problema. Aceita id, número ou código do pai; recusa ciclos. Filhos: \`GET .../tickets?parentId=<id>\`. Só agentes. ${access('EDIT')}`,
    consent: true,
    params: TICKET_PARAM,
    body: SetSdTicketParentSchema,
    responses: {
      200: { description: 'Chamado atualizado.', schema: SdTicketDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      ...TICKET_ERRORS,
      {
        code: 'VALIDATION_ERROR',
        when: 'O pai é o próprio chamado ou um descendente',
      },
    ],
  },
  {
    method: 'get',
    path: `${base}/tickets/{ticketId}/participants`,
    tags: [TICKETS],
    summary: 'Listar participantes',
    description: `Participantes ganham acesso ao chamado (inclusive solicitantes) e são notificados. ${access('VIEW')}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Participantes.', schema: z.array(SdUserSummaryDTO) },
    },
    errors: [...ACCESS_ERRORS, ...TICKET_ERRORS],
  },
  {
    method: 'post',
    path: `${base}/tickets/{ticketId}/participants`,
    tags: [TICKETS],
    summary: 'Adicionar participante',
    description: `Agentes, ou o solicitante do próprio chamado. O usuário precisa ser membro do workspace. Idempotente. ${access('EDIT')}`,
    consent: true,
    params: TICKET_PARAM,
    body: AddSdTicketParticipantSchema,
    responses: {
      201: {
        description: 'Participantes atualizados.',
        schema: z.array(SdUserSummaryDTO),
      },
    },
    errors: [
      ...ACCESS_ERRORS,
      ...TICKET_ERRORS,
      { code: 'VALIDATION_ERROR', when: 'Usuário não é membro do workspace' },
    ],
  },
  {
    method: 'delete',
    path: `${base}/tickets/{ticketId}/participants/{userId}`,
    tags: [TICKETS],
    summary: 'Remover participante',
    description: `Agentes, o solicitante do chamado ou o próprio participante (sair). ${access('EDIT')}`,
    consent: true,
    params: { ...TICKET_PARAM, userId: 'Usuário participante.' },
    responses: {
      200: {
        description: 'Participantes atualizados.',
        schema: z.array(SdUserSummaryDTO),
      },
    },
    errors: [...ACCESS_ERRORS, ...TICKET_ERRORS],
  },
  {
    method: 'get',
    path: `${base}/tickets/{ticketId}/events`,
    tags: [TICKETS],
    summary: 'Rastreabilidade do chamado',
    description: `Log append-only (\`SdTicketEvent\`), mais recentes primeiro, paginado por cursor. Relações vêm como \`{ id, label }\`. Só agentes. ${access('VIEW')}`,
    params: TICKET_PARAM,
    query: {
      type: 'object',
      properties: {
        cursor: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
    },
    responses: {
      200: { description: 'Eventos.', schema: SdTicketEventPageDTO },
    },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND'],
  },
  {
    method: 'get',
    path: `${base}/tickets/{ticketId}/escalations`,
    tags: [TICKETS],
    summary: 'Histórico de escalonamentos',
    description: `Manuais e automáticos (regras de SLA), mais recentes primeiro. Só agentes. ${access('VIEW')}`,
    params: TICKET_PARAM,
    responses: {
      200: {
        description: 'Escalonamentos.',
        schema: z.array(SdTicketEscalationDTO),
      },
    },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND'],
  },
  {
    method: 'post',
    path: `${base}/tickets/{ticketId}/escalations`,
    tags: [TICKETS],
    summary: 'Escalonar chamado',
    description: `**FUNCTIONAL**: para outro departamento e/ou pessoa (nível mantido). **HIERARCHICAL**: nível + 1, atribui a um líder do departamento (ou do departamento pai) e avisa os líderes. Notifica, grava evento e dispara \`TICKET_UPDATED\`. Só agentes. Auditado. ${access('EDIT')}`,
    consent: true,
    params: TICKET_PARAM,
    body: EscalateSdTicketSchema,
    responses: {
      201: {
        description: 'Chamado e o registro do escalonamento.',
        schema: z.object({
          ticket: SdTicketDTO,
          escalation: SdTicketEscalationDTO,
        }),
      },
    },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND', 'SD_DEPARTMENT_NOT_FOUND'],
  },
  {
    method: 'get',
    path: `${base}/events`,
    tags: [TICKETS],
    summary: 'Tempo real dos chamados (SSE)',
    description: `Server-Sent Events (\`text/event-stream\`) via Redis pub/sub (canal \`servicedesk:workspace:<id>\`). Ao conectar: \`: connected\`; heartbeat \`: ping\` a cada 25 s; cada evento: \`data: <json>\` — um **aviso** (\`type\`, \`ticketId\`, \`number\`, \`at\`, \`actorId\`, \`internal\`); recarregue pelas rotas normais. Agentes recebem tudo; solicitantes só eventos não internos dos próprios chamados. Sem replay nem rate limit. ${access('VIEW')}`,
    rateLimit: false,
    responses: {
      200: {
        description: 'Stream SSE aberto.',
        envelope: false,
        contentType: 'text/event-stream',
        schema: SdTicketRealtimeEventDTO,
        example:
          ': connected\n\ndata: {"type":"ticket.updated","ticketId":"ckv9x2p0h0000cv7d3k1e5abc","number":123,"at":"2026-09-21T12:00:00.000Z","actorId":null}\n\n: ping\n\n',
      },
    },
    errors: ACCESS_ERRORS,
  },
]

const VIEW_PARAM = { viewId: 'Id da visão salva.' }
const VIEW_ACCESS =
  'Acesso: agentes (membros de departamento) com o módulo **ServiceDesk** e `sd-tickets` × `VIEW`. Visões compartilhadas são editadas pelo dono e pelos admins do módulo.'

const viewRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${base}/saved-views`,
    tags: [VIEWS],
    summary: 'Listar visões salvas',
    description: `As próprias + as compartilhadas do workspace, por posição. \`editable\` indica se o usuário pode alterar. ${VIEW_ACCESS}`,
    responses: {
      200: { description: 'Visões.', schema: z.array(SdSavedViewDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: `${base}/saved-views`,
    tags: [VIEWS],
    summary: 'Criar visão salva',
    description: `Filtros no formato da query de \`GET .../tickets\`. ${VIEW_ACCESS}`,
    consent: true,
    body: CreateSdSavedViewSchema,
    responses: {
      201: { description: 'Visão criada.', schema: SdSavedViewDTO },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'patch',
    path: `${base}/saved-views/{viewId}`,
    tags: [VIEWS],
    summary: 'Atualizar visão salva',
    description: VIEW_ACCESS,
    consent: true,
    params: VIEW_PARAM,
    body: UpdateSdSavedViewSchema,
    responses: {
      200: { description: 'Visão atualizada.', schema: SdSavedViewDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Visão salva not found',
        when: 'Inexistente ou pessoal de outro usuário',
      },
    ],
  },
  {
    method: 'delete',
    path: `${base}/saved-views/{viewId}`,
    tags: [VIEWS],
    summary: 'Excluir visão salva',
    description: VIEW_ACCESS,
    consent: true,
    params: VIEW_PARAM,
    responses: { 200: { description: 'Excluída.', schema: null } },
    errors: [
      ...AGENT_ERRORS,
      {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Visão salva not found',
        when: 'Inexistente ou pessoal de outro usuário',
      },
    ],
  },
]

export function registerSdTicketPaths(registry: OpenApiRegistry): void {
  for (const route of [...ticketRoutes, ...viewRoutes]) {
    registry.registerRoute(route)
  }
}
