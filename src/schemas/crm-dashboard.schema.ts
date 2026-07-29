import z from 'zod'
import { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'

export const CreateCrmDashboardSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
})

export type CreateCrmDashboardDTO = z.infer<typeof CreateCrmDashboardSchema>

export const UpdateCrmDashboardSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).optional(),
})

export type UpdateCrmDashboardDTO = z.infer<typeof UpdateCrmDashboardSchema>

export const ReorderCrmDashboardsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmDashboardsDTO = z.infer<typeof ReorderCrmDashboardsSchema>

/* ----------------------------- config por tipo widget ---------------------------- */

export const WIDGET_TYPES = ['CHART', 'VIEW', 'IFRAME', 'RICH_TEXT'] as const
export type WidgetType = (typeof WIDGET_TYPES)[number]

/** Subtipos de chart (botões do topo do painel). */
export const CHART_TYPES = [
  'vertical',
  'horizontal',
  'line',
  'pie',
  'aggregate',
] as const
export type ChartType = (typeof CHART_TYPES)[number]

/**
 * Fontes de dados disponíveis para o widget "view" (sempre layout tabela) —
 * as entidades CRM do Steel que já têm endpoint de listagem por workspace.
 * Adaptação: o original também inclui `form-submissions`/`page-views`
 * (eventos, não a entidade), que o Steel não expõe como recurso de lista
 * dedicado — fora do escopo desta fase.
 */
export const VIEW_SOURCES = [
  'companies',
  'people',
  'opportunities',
  'leads',
  'tasks',
  'notes',
  'forms',
  'landing-pages',
  'whatsapp-conversations',
  'whatsapp-broadcasts',
] as const
export type ViewSource = (typeof VIEW_SOURCES)[number]

/** Fontes do chart: as do view + "socials" (séries das redes conectadas). */
export const CHART_SOURCES = [...VIEW_SOURCES, 'socials'] as const
export type ChartSource = (typeof CHART_SOURCES)[number]

/**
 * Métricas comparáveis entre redes/contas quando `source === "socials"`.
 * Sem OAuth real ainda (Fase 13 do plano), o backend de métricas sociais no
 * Steel não coleta esses dados — o widget fica funcional na UI, mas a série
 * vem vazia até essa integração existir.
 */
export const SOCIAL_METRICS = [
  'views',
  'followers',
  'impressions',
  'clicks',
  'conversions',
  'cost',
] as const
export type SocialMetric = (typeof SOCIAL_METRICS)[number]

export const FILTER_OPERATORS = [
  'contains',
  'equals',
  'not_equals',
  'is_empty',
  'is_not_empty',
] as const

const ViewFilterSchema = z.object({
  field: z.string().trim().min(1).max(100),
  operator: z.enum(FILTER_OPERATORS),
  value: z.string().trim().max(500).optional().default(''),
})

const ViewSortSchema = z.object({
  field: z.string().trim().min(1).max(100),
  direction: z.enum(['asc', 'desc']),
})

/** Modo de ordenação de um eixo (sem ordenação / crescente / decrescente). */
export const SORT_MODES = ['none', 'asc', 'desc'] as const
export type SortMode = (typeof SORT_MODES)[number]
const SortModeSchema = z.enum(SORT_MODES)

/**
 * Janela de comparação do widget "aggregate": total do período atual (N dias)
 * + variação % vs os N dias imediatamente anteriores. Só se aplica a
 * `chartType === "aggregate"`.
 */
export const COMPARE_RANGES = ['7d', '30d'] as const
export type CompareRange = (typeof COMPARE_RANGES)[number]
const CompareRangeSchema = z.enum(COMPARE_RANGES)

/**
 * Customização completa do chart. Os campos relevantes variam por
 * `chartType`; campos não usados pelo tipo são ignorados no render.
 * Agregação do valor: soma quando o campo de valor é numérico, senão
 * contagem.
 */
export const ChartConfigSchema = z.object({
  chartType: z.enum(CHART_TYPES),

  // Dados
  source: z.enum(CHART_SOURCES).default('companies'),
  filters: z.array(ViewFilterSchema).max(20).default([]),
  /** Redes a incluir quando source = "socials" (multi-select). */
  platforms: z.array(z.enum(CRM_SOCIAL_PLATFORMS)).max(6).default([]),
  /** Só usado quando `chartType === "aggregate"`. */
  compareRange: CompareRangeSchema.optional(),

  // Eixos / dados
  xField: z.string().trim().max(100).optional(),
  yField: z.string().trim().max(100).optional(),
  groupBy: z.string().trim().max(100).optional(),
  xSort: SortModeSchema.default('none'),
  ySort: SortModeSchema.default('none'),
  omitZero: z.boolean().default(false),
  cumulative: z.boolean().default(false),
  yMin: z.number().optional(),
  yMax: z.number().optional(),
  hideEmpty: z.boolean().default(false),

  // Estilo
  xAxisName: z.string().trim().max(100).default(''),
  yAxisName: z.string().trim().max(100).default(''),
  stacked: z.boolean().default(false),
  dataLabels: z.boolean().default(false),
  legend: z.boolean().default(true),
  prefix: z.string().trim().max(20).default(''),
  suffix: z.string().trim().max(20).default(''),
})

export const ViewConfigSchema = z.object({
  source: z.enum(VIEW_SOURCES),
  fields: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  filters: z.array(ViewFilterSchema).max(20).default([]),
  sort: z.array(ViewSortSchema).max(10).default([]),
})

export const IframeConfigSchema = z.object({
  url: z.url('Informe uma URL válida').max(2000),
})

export const RichTextConfigSchema = z.object({
  html: z.string().max(50_000, 'Conteúdo muito longo').default(''),
})

/** Schema de config correspondente ao tipo do widget. */
export function widgetConfigSchema(type: WidgetType) {
  switch (type) {
    case 'CHART':
      return ChartConfigSchema
    case 'VIEW':
      return ViewConfigSchema
    case 'IFRAME':
      return IframeConfigSchema
    case 'RICH_TEXT':
      return RichTextConfigSchema
  }
}

export type ChartConfig = z.infer<typeof ChartConfigSchema>
export type ViewConfig = z.infer<typeof ViewConfigSchema>
export type IframeConfig = z.infer<typeof IframeConfigSchema>
export type RichTextConfig = z.infer<typeof RichTextConfigSchema>

const layoutShape = {
  x: z.number().int().min(0).max(100).default(0),
  y: z.number().int().min(0).max(1000).default(0),
  w: z.number().int().min(1).max(12).default(4),
  h: z.number().int().min(1).max(60).default(6),
}

export const CreateCrmDashboardWidgetSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CHART'),
    config: ChartConfigSchema,
    ...layoutShape,
  }),
  z.object({
    type: z.literal('VIEW'),
    config: ViewConfigSchema,
    ...layoutShape,
  }),
  z.object({
    type: z.literal('IFRAME'),
    config: IframeConfigSchema,
    ...layoutShape,
  }),
  z.object({
    type: z.literal('RICH_TEXT'),
    config: RichTextConfigSchema,
    ...layoutShape,
  }),
])

export type CreateCrmDashboardWidgetDTO = z.infer<
  typeof CreateCrmDashboardWidgetSchema
>

/** Atualização parcial. `config` é validado contra o tipo do widget no service. */
export const UpdateCrmDashboardWidgetSchema = z
  .object({
    x: layoutShape.x.unwrap(),
    y: layoutShape.y.unwrap(),
    w: layoutShape.w.unwrap(),
    h: layoutShape.h.unwrap(),
    config: z.unknown(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  })

export type UpdateCrmDashboardWidgetDTO = z.infer<
  typeof UpdateCrmDashboardWidgetSchema
>

/** Atualização em lote das posições/tamanhos (drag/resize do grid). */
export const CrmDashboardWidgetLayoutBatchSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        x: layoutShape.x.unwrap(),
        y: layoutShape.y.unwrap(),
        w: layoutShape.w.unwrap(),
        h: layoutShape.h.unwrap(),
      }),
    )
    .max(200),
})

export type CrmDashboardWidgetLayoutBatchDTO = z.infer<
  typeof CrmDashboardWidgetLayoutBatchSchema
>
