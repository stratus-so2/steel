import {
  BarChartHorizontalIcon,
  BarChartIcon,
  Calculator01Icon,
  ChartLineData01Icon,
  GlobeIcon,
  PieChartIcon,
  PresentationBarChart01Icon,
  Table01Icon,
  TextFontIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type {
  ChartSource,
  ChartType,
  CompareRange,
  SocialMetric,
  ViewSource,
  WidgetType,
} from '@/src/schemas/crm-dashboard.schema'

export type WidgetTypeMeta = {
  type: WidgetType
  label: string
  description: string
  icon: typeof PresentationBarChart01Icon
}

export const WIDGET_TYPE_META: WidgetTypeMeta[] = [
  {
    type: 'CHART',
    label: 'Gráfico',
    description: 'Gráficos de barras, linha, pizza ou agregação.',
    icon: PresentationBarChart01Icon,
  },
  {
    type: 'VIEW',
    label: 'Tabela',
    description: 'Tabela de registros de uma fonte de dados.',
    icon: Table01Icon,
  },
  {
    type: 'IFRAME',
    label: 'Incorporar',
    description: 'Incorpora uma página externa por URL.',
    icon: GlobeIcon,
  },
  {
    type: 'RICH_TEXT',
    label: 'Texto rico',
    description: 'Texto livre formatado.',
    icon: TextFontIcon,
  },
]

export type ChartTypeMeta = {
  type: ChartType
  label: string
  icon: typeof BarChartIcon
}

export const CHART_TYPE_META: ChartTypeMeta[] = [
  { type: 'vertical', label: 'Barras verticais', icon: BarChartIcon },
  {
    type: 'horizontal',
    label: 'Barras horizontais',
    icon: BarChartHorizontalIcon,
  },
  { type: 'line', label: 'Linha', icon: ChartLineData01Icon },
  { type: 'pie', label: 'Pizza', icon: PieChartIcon },
  { type: 'aggregate', label: 'Agregação', icon: Calculator01Icon },
]

export type ViewField = { key: string; label: string }

/** Campos selecionáveis por fonte do widget "view" (chaves = campos do DTO). */
export const VIEW_SOURCE_FIELDS: Record<ViewSource, ViewField[]> = {
  companies: [
    { key: 'name', label: 'Nome' },
    { key: 'domain', label: 'Domínio' },
    { key: 'employeesCount', label: 'Funcionários' },
    { key: 'arr', label: 'ARR' },
    { key: 'icp', label: 'ICP' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  people: [
    { key: 'name', label: 'Nome' },
    { key: 'emails', label: 'E-mails' },
    { key: 'phones', label: 'Telefones' },
    { key: 'city', label: 'Cidade' },
    { key: 'jobTitle', label: 'Cargo' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  opportunities: [
    { key: 'name', label: 'Nome' },
    { key: 'stageId', label: 'Estágio' },
    { key: 'amount', label: 'Valor' },
    { key: 'closeDate', label: 'Fechamento' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  leads: [
    { key: 'name', label: 'Nome' },
    { key: 'company', label: 'Empresa' },
    { key: 'source', label: 'Origem' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  tasks: [
    { key: 'title', label: 'Título' },
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Vencimento' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  notes: [
    { key: 'title', label: 'Título' },
    { key: 'body', label: 'Conteúdo' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  forms: [
    { key: 'name', label: 'Nome' },
    { key: 'status', label: 'Status' },
    { key: 'submissionCount', label: 'Submissões' },
    { key: 'publishedAt', label: 'Publicado em' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  'landing-pages': [
    { key: 'title', label: 'Título' },
    { key: 'status', label: 'Status' },
    { key: 'viewsCount', label: 'Acessos' },
    { key: 'publishedAt', label: 'Publicado em' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  'whatsapp-conversations': [
    { key: 'contactName', label: 'Contato' },
    { key: 'contactWaId', label: 'Telefone' },
    { key: 'status', label: 'Status' },
    { key: 'aiActive', label: 'IA ativa' },
    { key: 'aiHandoff', label: 'Transferida p/ humano' },
    { key: 'unreadCount', label: 'Não lidas' },
    { key: 'avgSentimentScore', label: 'Sentimento médio' },
    { key: 'sentimentLabel', label: 'Faixa de sentimento (humor)' },
    { key: 'lastMessageAt', label: 'Última mensagem' },
    { key: 'createdAt', label: 'Criado em' },
  ],
  'whatsapp-broadcasts': [
    { key: 'name', label: 'Nome' },
    { key: 'status', label: 'Status' },
    { key: 'recipientCount', label: 'Destinatários' },
    { key: 'sentCount', label: 'Enviados' },
    { key: 'failedCount', label: 'Falhas' },
    { key: 'scheduledAt', label: 'Agendado para' },
    { key: 'createdAt', label: 'Criado em' },
  ],
}

export const VIEW_SOURCE_LABELS: Record<ViewSource, string> = {
  companies: 'Empresas',
  people: 'Pessoas',
  opportunities: 'Oportunidades',
  leads: 'Leads',
  tasks: 'Tarefas',
  notes: 'Notas',
  forms: 'Formulários',
  'landing-pages': 'Landing pages',
  'whatsapp-conversations': 'Conversas do WhatsApp',
  'whatsapp-broadcasts': 'Transmissões do WhatsApp',
}

/** Labels do chart: view sources + "socials". */
export const CHART_SOURCE_LABELS: Record<ChartSource, string> = {
  ...VIEW_SOURCE_LABELS,
  socials: 'Redes sociais',
}

/** Módulo dono de cada fonte — usado pra filtrar o dropdown por contexto
 * (um dashboard do CRM não deve oferecer fontes do WhatsApp, e vice-versa). */
export const SOURCE_MODULE: Record<ViewSource, 'CRM' | 'COMMUNICATION'> = {
  companies: 'CRM',
  people: 'CRM',
  opportunities: 'CRM',
  leads: 'CRM',
  tasks: 'CRM',
  notes: 'CRM',
  forms: 'CRM',
  'landing-pages': 'CRM',
  'whatsapp-conversations': 'COMMUNICATION',
  'whatsapp-broadcasts': 'COMMUNICATION',
}

/** Caminho de API por fonte (após `/api/workspaces/<id>/`). */
const SOURCE_PATH: Record<ViewSource, string> = {
  companies: 'crm/companies',
  people: 'crm/people',
  opportunities: 'crm/opportunities',
  leads: 'crm/leads',
  tasks: 'crm/tasks',
  notes: 'crm/notes',
  forms: 'crm/forms',
  'landing-pages': 'crm/landing-pages',
  'whatsapp-conversations': 'whatsapp/conversations',
  'whatsapp-broadcasts': 'whatsapp/broadcasts',
}

/** Traduz a fonte (valor do enum) para o caminho de API completo. */
export function sourceResource(source: ChartSource): string {
  if (source === 'socials') return ''
  return SOURCE_PATH[source]
}

export const COMPARE_RANGE_LABELS: Record<CompareRange, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
}

export const SOCIAL_METRIC_LABELS: Record<SocialMetric, string> = {
  views: 'Visualizações',
  followers: 'Seguidores ganhos',
  impressions: 'Impressões (Ads)',
  clicks: 'Cliques (Ads)',
  conversions: 'Conversões (Ads)',
  cost: 'Investimento (Ads)',
}
