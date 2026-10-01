import { z } from 'zod'
import {
  CreateCrmDashboardSchema,
  CreateCrmDashboardWidgetSchema,
  CrmDashboardWidgetLayoutBatchSchema,
  UpdateCrmDashboardSchema,
  UpdateCrmDashboardWidgetSchema,
} from '@/src/schemas/crm-dashboard.schema'
import { SubmitSdTicketCsatSchema } from '@/src/schemas/sd-ticket-csat.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdDashboardDTO,
  SdDashboardRowDTO,
  SdDashboardWidgetDTO,
  SdTicketCsatDTO,
} from '../../schemas/servicedesk/dashboards'

/**
 * ServiceDesk · painéis (`servicedesk/dashboards/**`, motor de dashboards
 * do CRM com `module = SERVICE_DESK`) e a avaliação CSAT do portal
 * (`servicedesk/tickets/{ticketId}/csat`).
 */

const PANELS = 'ServiceDesk · Painéis' as const
const TICKETS = 'ServiceDesk · Chamados' as const

const base = '/workspaces/{id}/servicedesk/dashboards'
const DASHBOARD = `${base}/{dashboardId}`
const DASHBOARD_PARAMS = { dashboardId: 'Id do dashboard.' }
const WIDGET_PARAMS = { ...DASHBOARD_PARAMS, widgetId: 'Id do widget.' }

function access(action: string): string {
  return `Acesso: sessão + **agente** do ServiceDesk (membro de um departamento, ou admin) com \`sd-dashboards\` × \`${action}\` (OWNER/ADMIN sempre passam). Solicitantes do portal não veem painéis.`
}

const ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
  { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
]

const NOT_FOUND: ErrorEntry = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'CrmDashboard not found',
  when: 'Dashboard inexistente ou de outro módulo (CRM/Comunicação)',
}

const WIDGET_NOT_FOUND: ErrorEntry = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'CrmDashboardWidget not found',
  when: 'Widget inexistente no dashboard',
}

export const sdDashboardsPortalRoutes: RouteConfig[] = [
  /* ------------------------------- dashboards ------------------------------ */
  {
    method: 'get',
    path: base,
    tags: [PANELS],
    summary: 'Listar painéis',
    description: `Painéis do ServiceDesk na ordem do usuário. Os padrões "Dashboard analítico" e "KPIs (TV)" são semeados ao liberar o módulo (e no "Restaurar padrões"). ${access('VIEW')}`,
    responses: {
      200: { description: 'Painéis.', schema: z.array(SdDashboardDTO) },
    },
    errors: ERRORS,
  },
  {
    method: 'post',
    path: base,
    tags: [PANELS],
    summary: 'Criar painel',
    description: `Cria um painel vazio no módulo \`SERVICE_DESK\`. Auditado. ${access('CREATE')}`,
    consent: true,
    body: CreateCrmDashboardSchema,
    responses: { 201: { description: 'Criado.', schema: SdDashboardDTO } },
    errors: ERRORS,
  },
  {
    method: 'patch',
    path: DASHBOARD,
    tags: [PANELS],
    summary: 'Renomear painel',
    description: `Só painéis do ServiceDesk (ids do CRM/Comunicação respondem 404). ${access('EDIT')}`,
    params: DASHBOARD_PARAMS,
    consent: true,
    body: UpdateCrmDashboardSchema,
    responses: { 200: { description: 'Atualizado.', schema: SdDashboardDTO } },
    errors: [...ERRORS, NOT_FOUND],
  },
  {
    method: 'delete',
    path: DASHBOARD,
    tags: [PANELS],
    summary: 'Excluir painel',
    description: `Exclusão lógica. Auditado. ${access('DELETE')}`,
    params: DASHBOARD_PARAMS,
    consent: true,
    responses: { 200: 'Excluído (`data: null`).' },
    errors: [...ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: `${DASHBOARD}/duplicate`,
    tags: [PANELS],
    summary: 'Duplicar painel',
    description: `Cria "<título> (cópia)" com todos os widgets. Auditado. ${access('CREATE')}`,
    params: DASHBOARD_PARAMS,
    consent: true,
    responses: { 201: { description: 'Cópia.', schema: SdDashboardDTO } },
    errors: [...ERRORS, NOT_FOUND],
  },

  /* -------------------------------- widgets -------------------------------- */
  {
    method: 'get',
    path: `${DASHBOARD}/widgets`,
    tags: [PANELS],
    summary: 'Listar widgets do painel',
    description: access('VIEW'),
    params: DASHBOARD_PARAMS,
    responses: {
      200: { description: 'Widgets.', schema: z.array(SdDashboardWidgetDTO) },
    },
    errors: [...ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: `${DASHBOARD}/widgets`,
    tags: [PANELS],
    summary: 'Adicionar widget',
    description: `\`CHART\`, \`VIEW\` (tabela), \`IFRAME\` ou \`RICH_TEXT\`, com posição no grid de 12 colunas. ${access('CREATE')}`,
    params: DASHBOARD_PARAMS,
    consent: true,
    body: CreateCrmDashboardWidgetSchema,
    responses: {
      201: { description: 'Criado.', schema: SdDashboardWidgetDTO },
    },
    errors: [...ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: `${DASHBOARD}/widgets/{widgetId}`,
    tags: [PANELS],
    summary: 'Atualizar widget',
    description: `Posição/tamanho e \`config\` (validada contra o tipo do widget). ${access('EDIT')}`,
    params: WIDGET_PARAMS,
    consent: true,
    body: UpdateCrmDashboardWidgetSchema,
    responses: {
      200: { description: 'Atualizado.', schema: SdDashboardWidgetDTO },
    },
    errors: [
      ...ERRORS,
      NOT_FOUND,
      WIDGET_NOT_FOUND,
      {
        code: 'VALIDATION_ERROR',
        message: 'Config inválida para este tipo de widget',
        when: '`config` não corresponde ao tipo do widget',
      },
    ],
  },
  {
    method: 'delete',
    path: `${DASHBOARD}/widgets/{widgetId}`,
    tags: [PANELS],
    summary: 'Remover widget',
    description: access('DELETE'),
    params: WIDGET_PARAMS,
    consent: true,
    responses: { 200: 'Removido (`data: null`).' },
    errors: [...ERRORS, NOT_FOUND, WIDGET_NOT_FOUND],
  },
  {
    method: 'post',
    path: `${DASHBOARD}/widgets/layout`,
    tags: [PANELS],
    summary: 'Aplicar layout (arrastar/redimensionar)',
    description: `Posições e tamanhos em lote. ${access('EDIT')}`,
    params: DASHBOARD_PARAMS,
    consent: true,
    body: CrmDashboardWidgetLayoutBatchSchema,
    responses: { 200: 'Aplicado (`data: null`).' },
    errors: [...ERRORS, NOT_FOUND],
  },

  /* --------------------------------- fontes -------------------------------- */
  {
    method: 'get',
    path: `${base}/sources/{source}`,
    tags: [PANELS],
    summary: 'Dados de uma fonte dos painéis',
    description: `Linhas achatadas que os widgets agregam no navegador (contagem, soma, média, baldes de data, período, comparação). Histórico de 400 dias (chamados em aberto entram sempre), com teto de linhas por fonte (10 mil chamados/custos, 20 mil eventos, 2 mil artigos). SLA de chamados em aberto em minutos úteis do calendário da política. ${access('VIEW')}`,
    params: {
      source: {
        description: 'Fonte de dados.',
        schema: {
          type: 'string',
          enum: [
            'sd-tickets',
            'sd-ticket-costs',
            'sd-ticket-events',
            'sd-kb-articles',
          ],
        },
      },
    },
    responses: {
      200: { description: 'Linhas.', schema: z.array(SdDashboardRowDTO) },
    },
    errors: [
      ...ERRORS,
      {
        code: 'VALIDATION_ERROR',
        message: 'Fonte de dados desconhecida',
        when: '`source` fora da lista',
      },
    ],
  },

  /* ---------------------------------- CSAT --------------------------------- */
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/tickets/{ticketId}/csat',
    tags: [TICKETS],
    summary: 'Avaliar o atendimento (CSAT)',
    description:
      'Nota de 1 a 5 e comentário opcional, pelo **solicitante** do chamado (ou o usuário do contato vinculado), só com o chamado resolvido/fechado e uma única vez. Gera o evento `csat.submitted` na rastreabilidade, aviso em tempo real e auditoria. Acesso: sessão + membro do ServiceDesk com `sd-tickets` × `EDIT`.',
    params: {
      ticketId: 'Id, número (`123`) ou código (`INC-000123`) do chamado.',
    },
    consent: true,
    body: SubmitSdTicketCsatSchema,
    responses: {
      201: { description: 'Avaliação registrada.', schema: SdTicketCsatDTO },
    },
    errors: [
      {
        code: 'FORBIDDEN',
        when: 'Não é membro do workspace ou o perfil não concede a permissão',
      },
      'WORKSPACE_SUSPENDED',
      { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
      'SD_TICKET_NOT_FOUND',
      {
        code: 'SD_TICKET_FORBIDDEN',
        when: 'Quem avalia não é o solicitante do chamado',
      },
      {
        code: 'SD_CSAT_NOT_AVAILABLE',
        when: 'Chamado ainda não resolvido/fechado',
      },
      { code: 'SD_CSAT_ALREADY_SUBMITTED', when: 'Chamado já avaliado' },
    ],
  },
]
