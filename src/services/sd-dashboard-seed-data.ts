import type z from 'zod'
import {
  ChartConfigSchema,
  type CreateCrmDashboardWidgetDTO,
  ViewConfigSchema,
} from '@/src/schemas/crm-dashboard.schema'

/**
 * Os dois dashboards padrão do ServiceDesk, semeados na liberação do módulo
 * (grid de 12 colunas; no modo TV as linhas se ajustam à altura da tela).
 * Todos usam as fontes `sd-*` (campos em `types/sd-dashboard.d.ts`).
 */

type Layout = { x: number; y: number; w: number; h: number }

function chart(
  config: z.input<typeof ChartConfigSchema>,
  layout: Layout,
): CreateCrmDashboardWidgetDTO {
  return { type: 'CHART', config: ChartConfigSchema.parse(config), ...layout }
}

function view(
  config: z.input<typeof ViewConfigSchema>,
  layout: Layout,
): CreateCrmDashboardWidgetDTO {
  return { type: 'VIEW', config: ViewConfigSchema.parse(config), ...layout }
}

const OPEN = { field: 'isOpen', operator: 'equals', value: 'true' } as const
const RESOLVED_30D = { period: '30d', periodField: 'resolvedAt' } as const

export const SD_ANALYTIC_DASHBOARD_TITLE = 'Dashboard analítico'
export const SD_TV_DASHBOARD_TITLE = 'KPIs (TV)'

const RED = '#ef4444'
const AMBER = '#f59e0b'
const GREEN = '#22c55e'

export const SD_ANALYTIC_WIDGETS: CreateCrmDashboardWidgetDTO[] = [
  // Linha 1 — números do período
  chart(
    {
      title: 'Em aberto',
      chartType: 'aggregate',
      source: 'sd-tickets',
      filters: [OPEN],
    },
    { x: 0, y: 0, w: 2, h: 4 },
  ),
  chart(
    {
      title: 'Abertos (30 dias)',
      chartType: 'aggregate',
      source: 'sd-tickets',
      compareRange: '30d',
    },
    { x: 2, y: 0, w: 2, h: 4 },
  ),
  chart(
    {
      title: 'SLA cumprido (30 dias)',
      chartType: 'aggregate',
      source: 'sd-tickets',
      yField: 'slaResolutionMetPct',
      aggregation: 'avg',
      suffix: '%',
      ...RESOLVED_30D,
    },
    { x: 4, y: 0, w: 2, h: 4 },
  ),
  chart(
    {
      title: 'MTTR (30 dias)',
      chartType: 'aggregate',
      source: 'sd-tickets',
      yField: 'resolutionHours',
      aggregation: 'avg',
      suffix: ' h',
      ...RESOLVED_30D,
    },
    { x: 6, y: 0, w: 2, h: 4 },
  ),
  chart(
    {
      title: 'Taxa de reabertura (30 dias)',
      chartType: 'aggregate',
      source: 'sd-tickets',
      yField: 'reopenedPct',
      aggregation: 'avg',
      suffix: '%',
      ...RESOLVED_30D,
    },
    { x: 8, y: 0, w: 2, h: 4 },
  ),
  chart(
    {
      title: 'CSAT médio (90 dias)',
      chartType: 'aggregate',
      source: 'sd-tickets',
      yField: 'csatScore',
      aggregation: 'avg',
      decimals: 1,
      suffix: ' / 5',
      period: '90d',
      periodField: 'resolvedAt',
    },
    { x: 10, y: 0, w: 2, h: 4 },
  ),

  // Linha 2 — fluxo e mix
  chart(
    {
      title: 'Criados × resolvidos (30 dias)',
      chartType: 'line',
      source: 'sd-ticket-events',
      filters: [{ field: 'throughput', operator: 'is_not_empty' }],
      xField: 'createdAt',
      dateBucket: 'day',
      groupBy: 'throughput',
      period: '30d',
      yAxisName: 'Chamados',
    },
    { x: 0, y: 4, w: 8, h: 8 },
  ),
  chart(
    {
      title: 'Volume por tipo (30 dias)',
      chartType: 'pie',
      source: 'sd-tickets',
      xField: 'type',
      period: '30d',
    },
    { x: 8, y: 4, w: 4, h: 8 },
  ),

  // Linha 3 — volume por prioridade/categoria e backlog por fase
  chart(
    {
      title: 'Volume por prioridade (30 dias)',
      chartType: 'vertical',
      source: 'sd-tickets',
      xField: 'priority',
      period: '30d',
      legend: false,
    },
    { x: 0, y: 12, w: 4, h: 7 },
  ),
  chart(
    {
      title: 'Volume por categoria (30 dias)',
      chartType: 'horizontal',
      source: 'sd-tickets',
      xField: 'category',
      period: '30d',
      ySort: 'desc',
      limit: 10,
      legend: false,
    },
    { x: 4, y: 12, w: 4, h: 7 },
  ),
  chart(
    {
      title: 'Backlog por fase',
      chartType: 'vertical',
      source: 'sd-tickets',
      filters: [OPEN],
      xField: 'phase',
      groupBy: 'type',
      stacked: true,
    },
    { x: 8, y: 12, w: 4, h: 7 },
  ),

  // Linha 4 — backlog por time e SLA
  chart(
    {
      title: 'Backlog por departamento',
      chartType: 'horizontal',
      source: 'sd-tickets',
      filters: [OPEN],
      xField: 'department',
      ySort: 'desc',
      legend: false,
    },
    { x: 0, y: 19, w: 4, h: 8 },
  ),
  chart(
    {
      title: 'Backlog por agente',
      chartType: 'horizontal',
      source: 'sd-tickets',
      filters: [OPEN],
      xField: 'assignee',
      ySort: 'desc',
      limit: 15,
      legend: false,
    },
    { x: 4, y: 19, w: 4, h: 8 },
  ),
  chart(
    {
      title: 'SLA cumprido por prioridade (%)',
      chartType: 'vertical',
      source: 'sd-tickets',
      xField: 'priority',
      yField: 'slaResolutionMetPct',
      aggregation: 'avg',
      yMin: 0,
      yMax: 100,
      dataLabels: true,
      legend: false,
      ...RESOLVED_30D,
    },
    { x: 8, y: 19, w: 4, h: 8 },
  ),

  // Linha 5 — tendência de MTTR e principais clientes
  chart(
    {
      title: 'MTTR por semana (h)',
      chartType: 'line',
      source: 'sd-tickets',
      xField: 'resolvedAt',
      dateBucket: 'week',
      yField: 'resolutionHours',
      aggregation: 'avg',
      period: '90d',
      periodField: 'resolvedAt',
      legend: false,
    },
    { x: 0, y: 27, w: 6, h: 7 },
  ),
  chart(
    {
      title: 'Top clientes (90 dias)',
      chartType: 'horizontal',
      source: 'sd-tickets',
      filters: [{ field: 'customer', operator: 'is_not_empty' }],
      xField: 'customer',
      ySort: 'desc',
      limit: 10,
      period: '90d',
      legend: false,
    },
    { x: 6, y: 27, w: 6, h: 7 },
  ),

  // Linha 6 — custos, satisfação e conhecimento
  chart(
    {
      title: 'Custos por categoria (90 dias)',
      chartType: 'pie',
      source: 'sd-ticket-costs',
      xField: 'category',
      yField: 'total',
      aggregation: 'sum',
      period: '90d',
      periodField: 'incurredAt',
    },
    { x: 0, y: 34, w: 4, h: 7 },
  ),
  chart(
    {
      title: 'CSAT — distribuição das notas (90 dias)',
      chartType: 'vertical',
      source: 'sd-tickets',
      filters: [{ field: 'csatScore', operator: 'is_not_empty' }],
      xField: 'csatScore',
      xSort: 'asc',
      period: '90d',
      periodField: 'resolvedAt',
      legend: false,
    },
    { x: 4, y: 34, w: 4, h: 7 },
  ),
  view(
    {
      title: 'Artigos mais vistos',
      source: 'sd-kb-articles',
      fields: ['title', 'viewCount', 'helpfulPct'],
      filters: [{ field: 'status', operator: 'equals', value: 'Publicado' }],
      sort: [{ field: 'viewCount', direction: 'desc' }],
      limit: 10,
    },
    { x: 8, y: 34, w: 4, h: 7 },
  ),
]

export const SD_TV_WIDGETS: CreateCrmDashboardWidgetDTO[] = [
  // Linha 1 — fila agora
  chart(
    {
      title: 'Abertos agora',
      chartType: 'aggregate',
      source: 'sd-tickets',
      filters: [OPEN],
    },
    { x: 0, y: 0, w: 3, h: 5 },
  ),
  chart(
    {
      title: 'Não atribuídos',
      chartType: 'aggregate',
      source: 'sd-tickets',
      filters: [{ field: 'isUnassigned', operator: 'equals', value: 'true' }],
    },
    { x: 3, y: 0, w: 3, h: 5 },
  ),
  chart(
    {
      title: 'SLA em risco',
      chartType: 'aggregate',
      source: 'sd-tickets',
      filters: [{ field: 'slaAtRisk', operator: 'equals', value: 'true' }],
      color: AMBER,
    },
    { x: 6, y: 0, w: 3, h: 5 },
  ),
  chart(
    {
      title: 'SLA violados',
      chartType: 'aggregate',
      source: 'sd-tickets',
      filters: [
        OPEN,
        { field: 'slaBreached', operator: 'equals', value: 'true' },
      ],
      color: RED,
    },
    { x: 9, y: 0, w: 3, h: 5 },
  ),

  // Linha 2 — desempenho
  chart(
    {
      title: 'Resolvidos hoje',
      chartType: 'aggregate',
      source: 'sd-tickets',
      period: 'today',
      periodField: 'resolvedAt',
      color: GREEN,
    },
    { x: 0, y: 5, w: 3, h: 5 },
  ),
  chart(
    {
      title: '% SLA no mês',
      chartType: 'aggregate',
      source: 'sd-tickets',
      yField: 'slaResolutionMetPct',
      aggregation: 'avg',
      suffix: '%',
      period: 'month',
      periodField: 'resolvedAt',
    },
    { x: 3, y: 5, w: 3, h: 5 },
  ),
  chart(
    {
      title: 'MTTR hoje',
      chartType: 'aggregate',
      source: 'sd-tickets',
      yField: 'resolutionHours',
      aggregation: 'avg',
      suffix: ' h',
      period: 'today',
      periodField: 'resolvedAt',
    },
    { x: 6, y: 5, w: 3, h: 5 },
  ),
  chart(
    {
      title: 'CSAT (mês)',
      chartType: 'aggregate',
      source: 'sd-tickets',
      yField: 'csatScore',
      aggregation: 'avg',
      decimals: 1,
      suffix: ' / 5',
      period: 'month',
      periodField: 'resolvedAt',
    },
    { x: 9, y: 5, w: 3, h: 5 },
  ),

  // Linha 3 — listas e produtividade
  view(
    {
      title: 'SLA em risco',
      source: 'sd-tickets',
      fields: ['code', 'title', 'priority', 'assignee', 'resolutionDueIn'],
      filters: [{ field: 'slaAtRisk', operator: 'equals', value: 'true' }],
      sort: [{ field: 'resolutionRemainingMinutes', direction: 'asc' }],
      limit: 12,
    },
    { x: 0, y: 10, w: 4, h: 9 },
  ),
  view(
    {
      title: 'Críticos abertos',
      source: 'sd-tickets',
      fields: ['code', 'title', 'phase', 'assignee', 'ageHours'],
      filters: [
        OPEN,
        { field: 'isCritical', operator: 'equals', value: 'true' },
      ],
      sort: [{ field: 'ageHours', direction: 'desc' }],
      limit: 12,
    },
    { x: 4, y: 10, w: 4, h: 9 },
  ),
  chart(
    {
      title: 'Resolvidos por agente hoje',
      chartType: 'horizontal',
      source: 'sd-tickets',
      filters: [{ field: 'assignee', operator: 'is_not_empty' }],
      xField: 'assignee',
      ySort: 'desc',
      limit: 10,
      period: 'today',
      periodField: 'resolvedAt',
      dataLabels: true,
      legend: false,
    },
    { x: 8, y: 10, w: 4, h: 9 },
  ),
]

export const SD_DEFAULT_DASHBOARDS = [
  { title: SD_ANALYTIC_DASHBOARD_TITLE, widgets: SD_ANALYTIC_WIDGETS },
  { title: SD_TV_DASHBOARD_TITLE, widgets: SD_TV_WIDGETS },
] as const
