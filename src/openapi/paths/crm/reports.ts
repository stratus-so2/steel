import { z } from 'zod'
import {
  CreateCrmDashboardSchema,
  CreateCrmDashboardWidgetSchema,
  CrmDashboardWidgetLayoutBatchSchema,
  UpdateCrmDashboardSchema,
  UpdateCrmDashboardWidgetSchema,
} from '@/src/schemas/crm-dashboard.schema'
import {
  CreateCrmReportSchema,
  UpdateCrmReportSchema,
} from '@/src/schemas/crm-report.schema'
import { flag } from '../../common'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  CrmDashboardDTO,
  CrmDashboardWidgetDTO,
  CrmReportDataDTO,
  CrmReportDTO,
} from '../../schemas/crm/reports'
import { CRM_ERRORS, crmAccess, describe, notFoundError } from './shared'

/**
 * CRM · Relatórios e dashboards — `reports`, `dashboards` e widgets.
 *
 * Leituras/edições por ID checam a permissão no workspace e depois exigem
 * habilitado o módulo **dono** do registro (`module`), que nas rotas do CRM
 * é sempre `CRM`.
 */

const TAGS: RouteConfig['tags'] = ['CRM · Relatórios e dashboards']

const REPORT_ID = 'ID do relatório.'
const DASHBOARD_ID = 'ID do dashboard.'
const WIDGET_ID = 'ID do widget.'

const REPORT_NOT_FOUND = notFoundError(
  'CrmReport',
  'Relatório inexistente no workspace',
)
const DASHBOARD_NOT_FOUND = notFoundError(
  'CrmDashboard',
  'Dashboard inexistente no workspace',
)
const WIDGET_NOT_FOUND = notFoundError(
  'CrmDashboardWidget',
  'Widget inexistente neste dashboard',
)

const RUN_NOTE =
  'Cada dataset é lido pelo service da fonte com a permissão `VIEW` do usuário (e, para `whatsapp_*`, com o módulo Comunicação habilitado) — sem acesso a uma fonte, a execução falha com o erro dela (`403`).'

const RUN_ERRORS: ErrorEntry[] = [...CRM_ERRORS, REPORT_NOT_FOUND]

export const crmReportsRoutes: RouteConfig[] = [
  /* ------------------------------ relatórios ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/reports',
    tags: TAGS,
    summary: 'Listar relatórios',
    description: describe(
      'Relatórios do módulo CRM, na ordem de `position`.',
      crmAccess('reports', 'VIEW'),
    ),
    responses: {
      200: { description: 'Relatórios.', schema: z.array(CrmReportDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/reports',
    tags: TAGS,
    summary: 'Criar relatório',
    description: describe(
      [
        'Dois formatos:',
        '',
        '- **Simples** (legado): `source` + `columns` (+ `filters`, `groupBy`, `sort`) sobre uma única fonte;',
        '- **Mega relatório**: `query` com vários datasets combinados por `join` (mesclagem por chave, colunas `alias.campo`) ou `union` (empilhamento com colunas mapeadas), com agrupamento/agregação (`count`, `sum`, `avg`, `min`, `max`) e ordenação.',
        '',
        '`source`/`columns` continuam obrigatórios mesmo com `query`.',
      ].join('\n'),
      crmAccess('reports', 'CREATE'),
    ),
    consent: true,
    body: {
      schema: CreateCrmReportSchema,
      example: {
        name: 'Oportunidades abertas',
        source: 'opportunity',
        columns: ['name', 'amount', 'stageId'],
        filters: [
          { field: 'name', operator: 'contains', value: 'ServiceDesk' },
        ],
        sort: { field: 'amount', direction: 'desc' },
      },
    },
    responses: {
      201: { description: 'Relatório criado.', schema: CrmReportDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/reports/{reportId}',
    tags: TAGS,
    summary: 'Detalhe do relatório',
    description: describe(
      'Definição do relatório (sem executar). Os dados vêm de `GET .../data`.',
      crmAccess('reports', 'VIEW'),
    ),
    params: { reportId: REPORT_ID },
    responses: { 200: { description: 'Relatório.', schema: CrmReportDTO } },
    errors: RUN_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/reports/{reportId}',
    tags: TAGS,
    summary: 'Atualizar relatório',
    description: describe(
      'Atualização parcial — informe ao menos um campo. `null` limpa `groupBy`, `sort` ou `query`.',
      crmAccess('reports', 'EDIT'),
    ),
    params: { reportId: REPORT_ID },
    consent: true,
    body: UpdateCrmReportSchema,
    responses: {
      200: { description: 'Relatório atualizado.', schema: CrmReportDTO },
    },
    errors: RUN_ERRORS,
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/reports/{reportId}',
    tags: TAGS,
    summary: 'Excluir relatório',
    description: crmAccess('reports', 'DELETE'),
    params: { reportId: REPORT_ID },
    consent: true,
    responses: { 200: { description: 'Relatório excluído.', schema: null } },
    errors: RUN_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/reports/{reportId}/data',
    tags: TAGS,
    summary: 'Executar relatório',
    description: describe(
      'Executa a query do relatório e devolve colunas + linhas processadas (sem paginação).',
      RUN_NOTE,
      crmAccess('reports', 'VIEW'),
    ),
    params: { reportId: REPORT_ID },
    responses: {
      200: { description: 'Dados do relatório.', schema: CrmReportDataDTO },
    },
    errors: RUN_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/reports/{reportId}/export',
    tags: TAGS,
    summary: 'Exportar relatório',
    description: describe(
      'Executa o relatório e devolve o arquivo para download (fora do envelope JSON), com os rótulos das colunas no cabeçalho. `format=xlsx` (ou `excel`) gera planilha SpreadsheetML (`relatorio.xls`); qualquer outro valor, ou nenhum, gera CSV (`relatorio.csv`). Erros continuam no envelope JSON.',
      RUN_NOTE,
      crmAccess('reports', 'VIEW'),
    ),
    params: { reportId: REPORT_ID },
    query: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['csv', 'xlsx', 'excel'],
          description: 'Formato do arquivo (padrão CSV).',
        },
      },
    },
    responses: {
      200: {
        description:
          'Arquivo CSV (`text/csv`) ou SpreadsheetML (`application/vnd.ms-excel`), com `Content-Disposition: attachment`.',
        envelope: false,
        contentType: 'text/csv',
        schema: { type: 'string' },
        example: 'Nome,Valor\nImplantação ServiceDesk,12000\n',
        headers: {
          'Content-Disposition': {
            description:
              '`attachment; filename="relatorio.csv"` (ou `relatorio.xls`).',
          },
        },
      },
    },
    errors: RUN_ERRORS,
  },

  /* ------------------------------ dashboards ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/dashboards',
    tags: TAGS,
    summary: 'Listar dashboards',
    description: describe(
      'Dashboards do módulo CRM, na ordem de `position`.',
      crmAccess('dashboards', 'VIEW'),
    ),
    responses: {
      200: { description: 'Dashboards.', schema: z.array(CrmDashboardDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/dashboards',
    tags: TAGS,
    summary: 'Criar dashboard',
    description: describe(
      'Cria um dashboard vazio; os widgets são adicionados depois.',
      crmAccess('dashboards', 'CREATE'),
    ),
    consent: true,
    body: {
      schema: CreateCrmDashboardSchema,
      example: { title: 'Vendas do trimestre' },
    },
    responses: {
      201: { description: 'Dashboard criado.', schema: CrmDashboardDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/dashboards/{dashboardId}',
    tags: TAGS,
    summary: 'Renomear dashboard',
    description: crmAccess('dashboards', 'EDIT'),
    params: { dashboardId: DASHBOARD_ID },
    consent: true,
    body: UpdateCrmDashboardSchema,
    responses: {
      200: { description: 'Dashboard atualizado.', schema: CrmDashboardDTO },
    },
    errors: [...CRM_ERRORS, DASHBOARD_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/dashboards/{dashboardId}',
    tags: TAGS,
    summary: 'Excluir dashboard',
    description: crmAccess('dashboards', 'DELETE'),
    params: { dashboardId: DASHBOARD_ID },
    consent: true,
    responses: { 200: { description: 'Dashboard excluído.', schema: null } },
    errors: [...CRM_ERRORS, DASHBOARD_NOT_FOUND],
  },

  /* -------------------------------- widgets ------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/dashboards/{dashboardId}/widgets',
    tags: TAGS,
    summary: 'Listar widgets do dashboard',
    description: crmAccess('dashboards', 'VIEW'),
    params: { dashboardId: DASHBOARD_ID },
    responses: {
      200: { description: 'Widgets.', schema: z.array(CrmDashboardWidgetDTO) },
    },
    errors: [...CRM_ERRORS, DASHBOARD_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/dashboards/{dashboardId}/widgets',
    tags: TAGS,
    summary: 'Adicionar widget',
    description: describe(
      '`type` define o formato de `config`: `CHART` (gráfico sobre uma fonte do CRM ou `socials`), `VIEW` (tabela de uma fonte), `IFRAME` (`url`) ou `RICH_TEXT` (`html`). Posição/tamanho no grid de 12 colunas em `x`, `y`, `w`, `h`.',
      crmAccess('dashboards', 'CREATE'),
    ),
    params: { dashboardId: DASHBOARD_ID },
    consent: true,
    body: {
      schema: CreateCrmDashboardWidgetSchema,
      example: {
        type: 'CHART',
        config: {
          chartType: 'vertical',
          source: 'opportunities',
          xField: 'stageId',
          yField: 'amount',
        },
        x: 0,
        y: 0,
        w: 6,
        h: 6,
      },
    },
    responses: {
      201: { description: 'Widget criado.', schema: CrmDashboardWidgetDTO },
    },
    errors: [...CRM_ERRORS, DASHBOARD_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/dashboards/{dashboardId}/widgets/layout',
    tags: TAGS,
    summary: 'Salvar layout dos widgets',
    description: describe(
      'Atualiza em lote posição e tamanho dos widgets (drag/resize do grid). Responde `202`.',
      crmAccess('dashboards', 'EDIT'),
    ),
    params: { dashboardId: DASHBOARD_ID },
    body: {
      schema: CrmDashboardWidgetLayoutBatchSchema,
      example: {
        items: [{ id: 'ckw1wdgt0000ab7d3k1e5xyz', x: 0, y: 0, w: 6, h: 6 }],
      },
    },
    responses: {
      202: { description: 'Layout aplicado.', schema: flag('applied') },
    },
    errors: [...CRM_ERRORS, DASHBOARD_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/dashboards/{dashboardId}/widgets/{widgetId}',
    tags: TAGS,
    summary: 'Atualizar widget',
    description: describe(
      'Atualização parcial de `x`, `y`, `w`, `h` e `config`. O `type` não muda; `config` é validado contra o tipo do widget.',
      crmAccess('dashboards', 'EDIT'),
    ),
    params: { dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID },
    consent: true,
    body: UpdateCrmDashboardWidgetSchema,
    responses: {
      200: { description: 'Widget atualizado.', schema: CrmDashboardWidgetDTO },
    },
    errors: [
      ...CRM_ERRORS,
      DASHBOARD_NOT_FOUND,
      WIDGET_NOT_FOUND,
      {
        code: 'VALIDATION_ERROR',
        message: 'Config inválida para este tipo de widget',
        when: '`config` não confere com o tipo do widget',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/dashboards/{dashboardId}/widgets/{widgetId}',
    tags: TAGS,
    summary: 'Remover widget',
    description: crmAccess('dashboards', 'DELETE'),
    params: { dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID },
    consent: true,
    responses: { 200: { description: 'Widget removido.', schema: null } },
    errors: [...CRM_ERRORS, DASHBOARD_NOT_FOUND, WIDGET_NOT_FOUND],
  },
]
