'use client'

import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded'
import dynamic from 'next/dynamic'
import * as React from 'react'
import {
  CHART_SOURCE_LABELS,
  CHART_TYPE_META,
  COMPARE_RANGE_LABELS,
  SOCIAL_METRIC_LABELS,
  VIEW_SOURCE_FIELDS,
  VIEW_SOURCE_LABELS,
  WIDGET_TYPE_META,
} from '@/app/_components/crm/dashboard/widget-meta'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  createCrmDashboardWidget,
  updateCrmDashboardWidget,
} from '@/src/hooks/use-crm-dashboard-widget'
import {
  CHART_SOURCES,
  type ChartConfig,
  ChartConfigSchema,
  type ChartSource,
  type ChartType,
  COMPARE_RANGES,
  FILTER_OPERATORS,
  type IframeConfig,
  type RichTextConfig,
  SOCIAL_METRICS,
  SORT_MODES,
  type SocialMetric,
  type SortMode,
  VIEW_SOURCES,
  type ViewConfig,
  ViewConfigSchema,
  type ViewSource,
  type WidgetType,
} from '@/src/schemas/crm-dashboard.schema'
import { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'
import type { CrmDashboardWidgetDTO } from '@/types/crm-dashboard'
import type { CrmSocialPlatformDTO } from '@/types/crm-social'

const RichTextPanel = dynamic(
  () =>
    import('@/app/_components/crm/table/rich-text-panel').then(
      (m) => m.RichTextPanel,
    ),
  { ssr: false },
)

const NONE = '__none__'

type ViewFilter = ViewConfig['filters'][number]

const SOCIAL_PLATFORM_LABELS: Record<CrmSocialPlatformDTO, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  TWITTER: 'X (Twitter)',
  LINKEDIN: 'LinkedIn',
}

/**
 * Todas as plataformas do Steel valem para toda métrica social — sem OAuth
 * real ainda (Fase 13 do plano), o Steel não distingue quais plataformas
 * fornecem cada métrica (isso dependeria da API específica de cada rede).
 */
const PLATFORMS_BY_METRIC: Record<SocialMetric, CrmSocialPlatformDTO[]> =
  Object.fromEntries(
    SOCIAL_METRICS.map((m) => [m, [...CRM_SOCIAL_PLATFORMS]]),
  ) as Record<SocialMetric, CrmSocialPlatformDTO[]>

/** Eixos/agrupamento automáticos do chart quando source = "socials". */
function socialsDefaults(
  chartType: ChartType,
  metric: SocialMetric,
): Partial<ChartConfig> {
  const base = { xSort: 'none' as const, ySort: 'none' as const }
  if (chartType === 'pie') {
    return { ...base, xField: 'platform', yField: metric, groupBy: undefined }
  }
  if (chartType === 'aggregate') {
    return { ...base, xField: undefined, yField: metric, groupBy: undefined }
  }
  return { ...base, xField: 'date', yField: metric, groupBy: 'platform' }
}

/** Tamanho default do widget novo no grid (cols de 12, rowHeight ~40px). */
const DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  CHART: { w: 6, h: 7 },
  VIEW: { w: 6, h: 8 },
  IFRAME: { w: 6, h: 8 },
  RICH_TEXT: { w: 4, h: 6 },
}

function defaultConfig(type: WidgetType): Record<string, unknown> {
  switch (type) {
    case 'CHART':
      return ChartConfigSchema.parse({ chartType: 'vertical' })
    case 'VIEW':
      return ViewConfigSchema.parse({ source: 'companies' })
    case 'IFRAME':
      return { url: '' }
    case 'RICH_TEXT':
      return { html: '' }
  }
}

const OPERATOR_LABELS: Record<(typeof FILTER_OPERATORS)[number], string> = {
  contains: 'contém',
  equals: 'igual a',
  not_equals: 'diferente de',
  is_empty: 'vazio',
  is_not_empty: 'preenchido',
}

const SORT_MODE_LABELS: Record<SortMode, string> = {
  none: 'Sem ordenação',
  asc: 'Crescente',
  desc: 'Decrescente',
}

export function WidgetPanel({
  open,
  onOpenChange,
  workspaceId,
  dashboardId,
  editing,
  nextY,
  onCreated,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  dashboardId: string
  editing: CrmDashboardWidgetDTO | null
  nextY: number
  onCreated: (widget: CrmDashboardWidgetDTO) => void
  onUpdated: (widget: CrmDashboardWidgetDTO) => void
}) {
  const isEditing = Boolean(editing)
  const [type, setType] = React.useState<WidgetType | null>(null)
  const [config, setConfig] = React.useState<Record<string, unknown>>({})
  const [saving, setSaving] = React.useState(false)
  const [richOpen, setRichOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (editing) {
      setType(editing.type)
      setConfig({ ...editing.config })
    } else {
      setType(null)
      setConfig({})
    }
  }, [open, editing])

  function chooseType(next: WidgetType) {
    setType(next)
    setConfig(defaultConfig(next))
  }

  async function handleSave() {
    if (!type) return
    setSaving(true)
    try {
      if (isEditing && editing) {
        const res = await updateCrmDashboardWidget(
          workspaceId,
          dashboardId,
          editing.id,
          { config },
        )
        if (!res.ok || !res.data) {
          notify.error(res.message ?? 'Não foi possível salvar o widget.')
          return
        }
        onUpdated(res.data)
      } else {
        const { w, h } = DEFAULT_SIZE[type]
        const res = await createCrmDashboardWidget(workspaceId, dashboardId, {
          type,
          config,
          x: 0,
          y: nextY,
          w,
          h,
        } as Parameters<typeof createCrmDashboardWidget>[2])
        if (!res.ok || !res.data) {
          notify.error(res.message ?? 'Não foi possível criar o widget.')
          return
        }
        onCreated(res.data)
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const title = isEditing ? 'Editar widget' : 'Novo widget'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        showCloseButton={false}
        className='flex w-[440px] max-w-[440px] flex-col gap-0 p-0 sm:max-w-[440px]'
      >
        <div className='flex items-center gap-2 border-b p-3'>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={() => onOpenChange(false)}
            aria-label='Cancelar'
          >
            <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
          <SheetTitle className='truncate'>{title}</SheetTitle>
        </div>

        <div className='min-h-0 flex-1 space-y-5 overflow-y-auto p-4'>
          {!type ? (
            <TypePicker onPick={chooseType} />
          ) : (
            <>
              {!isEditing ? (
                <button
                  type='button'
                  onClick={() => setType(null)}
                  className='text-muted-foreground text-xs hover:text-foreground'
                >
                  ← Trocar tipo de widget
                </button>
              ) : null}

              {type === 'CHART' ? (
                <ChartEditor
                  config={config as ChartConfig}
                  onChange={setConfig}
                />
              ) : null}
              {type === 'VIEW' ? (
                <ViewEditor
                  config={config as ViewConfig}
                  onChange={setConfig}
                />
              ) : null}
              {type === 'IFRAME' ? (
                <IframeEditor
                  config={config as IframeConfig}
                  onChange={setConfig}
                />
              ) : null}
              {type === 'RICH_TEXT' ? (
                <RichTextEditor
                  config={config as RichTextConfig}
                  onEdit={() => setRichOpen(true)}
                />
              ) : null}
            </>
          )}
        </div>

        {type ? (
          <div className='flex items-center justify-end border-t p-3'>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        ) : null}
      </SheetContent>

      {type === 'RICH_TEXT' ? (
        <RichTextPanel
          open={richOpen}
          onOpenChange={setRichOpen}
          title='Conteúdo do widget'
          value={(config as RichTextConfig).html ?? ''}
          onSave={(html) => setConfig((prev) => ({ ...prev, html }))}
        />
      ) : null}
    </Sheet>
  )
}

/* --------------------------------- passo 1 --------------------------------- */

function TypePicker({ onPick }: { onPick: (type: WidgetType) => void }) {
  return (
    <div className='space-y-3'>
      <p className='text-muted-foreground text-sm'>
        Escolha o tipo de widget para adicionar ao dashboard.
      </p>
      <div className='grid grid-cols-2 gap-2'>
        {WIDGET_TYPE_META.map((meta) => (
          <button
            key={meta.type}
            type='button'
            onClick={() => onPick(meta.type)}
            className='flex flex-col items-start gap-2 rounded-lg border border-border/70 bg-card/60 p-3 text-left transition-colors hover:border-border hover:bg-accent'
          >
            <SteelIcon
              icon={meta.icon}
              strokeWidth={1.8}
              className='size-5 text-muted-foreground'
            />
            <span className='font-medium text-sm'>{meta.label}</span>
            <span className='text-muted-foreground text-xs'>
              {meta.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------- controles base ------------------------------ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
      {children}
    </h3>
  )
}

function Labeled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1.5'>
      <span className='block text-sm'>{label}</span>
      {children}
    </div>
  )
}

function SourceSelect({
  value,
  onChange,
}: {
  value: ViewSource
  onChange: (value: ViewSource) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ViewSource)}>
      <SelectTrigger className='w-full'>
        <span>{VIEW_SOURCE_LABELS[value]}</span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {VIEW_SOURCES.map((source) => (
          <SelectItem key={source} value={source}>
            {VIEW_SOURCE_LABELS[source]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ChartSourceSelect({
  value,
  onChange,
}: {
  value: ChartSource
  onChange: (value: ChartSource) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ChartSource)}>
      <SelectTrigger className='w-full'>
        <span>{CHART_SOURCE_LABELS[value]}</span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {CHART_SOURCES.map((source) => (
          <SelectItem key={source} value={source}>
            {CHART_SOURCE_LABELS[source]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FieldSelect({
  source,
  value,
  onChange,
  allowNone,
  noneLabel,
}: {
  source: ViewSource
  value: string | undefined
  onChange: (value: string | undefined) => void
  allowNone?: boolean
  noneLabel?: string
}) {
  const fields = VIEW_SOURCE_FIELDS[source] ?? []
  const current = value ?? ''
  return (
    <Select
      value={current || NONE}
      onValueChange={(v) => onChange(v === NONE ? undefined : String(v))}
    >
      <SelectTrigger size='sm' className='w-full'>
        <span className='truncate'>
          {current
            ? (fields.find((f) => f.key === current)?.label ?? current)
            : (noneLabel ?? 'Selecionar')}
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {allowNone ? (
          <>
            <SelectItem value={NONE}>{noneLabel ?? '— nenhum —'}</SelectItem>
            <SelectSeparator />
          </>
        ) : null}
        {fields.map((f) => (
          <SelectItem key={f.key} value={f.key}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SortModeSelect({
  value,
  onChange,
}: {
  value: SortMode
  onChange: (value: SortMode) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortMode)}>
      <SelectTrigger size='sm' className='w-full'>
        <span>{SORT_MODE_LABELS[value]}</span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {SORT_MODES.map((mode) => (
          <SelectItem key={mode} value={mode}>
            {SORT_MODE_LABELS[mode]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className='flex items-center justify-between gap-2 text-sm'>
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <div className='flex-1 space-y-1'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <Input
        type='number'
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
      />
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div className='flex-1 space-y-1'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <Input
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** Editor de filtros reutilizado por view e chart (campos do source). */
function FilterEditor({
  source,
  filters,
  onChange,
}: {
  source: ViewSource
  filters: ViewFilter[]
  onChange: (filters: ViewFilter[]) => void
}) {
  const sourceFields = VIEW_SOURCE_FIELDS[source] ?? []

  function add() {
    const first = sourceFields[0]?.key ?? ''
    onChange([...filters, { field: first, operator: 'contains', value: '' }])
  }
  function update(index: number, patch: Partial<ViewFilter>) {
    onChange(filters.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }
  function remove(index: number) {
    onChange(filters.filter((_, i) => i !== index))
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <span className='font-medium text-sm'>Filtros</span>
        <Button variant='outline' size='sm' onClick={add}>
          + Filtro
        </Button>
      </div>
      {filters.length === 0 ? (
        <p className='text-muted-foreground text-xs'>Nenhum filtro.</p>
      ) : (
        <div className='space-y-2'>
          {filters.map((filter, index) => {
            const needsValue =
              filter.operator !== 'is_empty' &&
              filter.operator !== 'is_not_empty'
            return (
              <div
                key={`${filter.field}-${index}`}
                className='space-y-1.5 rounded-md border border-border/70 p-2'
              >
                <div className='flex gap-1.5'>
                  <div className='flex-1'>
                    <FieldSelect
                      source={source}
                      value={filter.field}
                      onChange={(v) => update(index, { field: v ?? '' })}
                    />
                  </div>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => remove(index)}
                    aria-label='Remover filtro'
                  >
                    <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
                  </Button>
                </div>
                <Select
                  value={filter.operator}
                  onValueChange={(v) =>
                    update(index, { operator: v as ViewFilter['operator'] })
                  }
                >
                  <SelectTrigger size='sm' className='w-full'>
                    <span>{OPERATOR_LABELS[filter.operator]}</span>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {FILTER_OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {needsValue ? (
                  <Input
                    value={filter.value ?? ''}
                    placeholder='Valor'
                    onChange={(e) => update(index, { value: e.target.value })}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------- chart editor ------------------------------ */

function ChartEditor({
  config,
  onChange,
}: {
  config: ChartConfig
  onChange: (config: Record<string, unknown>) => void
}) {
  const c = config
  const set = (patch: Partial<ChartConfig>) => onChange({ ...c, ...patch })
  const type = c.chartType ?? 'vertical'
  const isHorizontal = type === 'horizontal'
  const isBarLine =
    type === 'vertical' || type === 'horizontal' || type === 'line'
  const isSocials = c.source === 'socials'
  const viewSource = c.source as ViewSource

  function setChartType(next: ChartType) {
    if (isSocials) {
      const metric = ((c.yField as SocialMetric | undefined) ??
        'views') as SocialMetric
      onChange({ ...c, chartType: next, ...socialsDefaults(next, metric) })
    } else {
      set({ chartType: next })
    }
  }

  function setSource(source: ChartSource) {
    if (source === 'socials') {
      onChange({
        ...c,
        source,
        filters: [],
        platforms: [],
        ...socialsDefaults(c.chartType, 'views'),
      })
    } else {
      onChange({
        ...c,
        source,
        xField: undefined,
        yField: undefined,
        groupBy: undefined,
        filters: [],
        platforms: [],
      })
    }
  }

  return (
    <div className='space-y-5'>
      <div className='flex w-full items-center gap-1.5'>
        {CHART_TYPE_META.map((meta) => (
          <div key={meta.type} className='flex-1'>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={type === meta.type ? 'default' : 'outline'}
                    size='icon'
                    className='w-full'
                    onClick={() => setChartType(meta.type)}
                    aria-label={meta.label}
                  />
                }
              >
                <SteelIcon icon={meta.icon} strokeWidth={1.8} />
              </TooltipTrigger>
              <TooltipContent side='bottom'>{meta.label}</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>

      <section className='space-y-3'>
        <SectionTitle>Dados</SectionTitle>
        <Labeled label='Fonte'>
          <ChartSourceSelect value={c.source} onChange={setSource} />
        </Labeled>
        {isSocials ? (
          <SocialsFields config={c} set={set} />
        ) : (
          <FilterEditor
            source={viewSource}
            filters={c.filters}
            onChange={(filters) => set({ filters })}
          />
        )}
      </section>

      {isSocials ? null : type === 'aggregate' ? (
        <AggregateFields config={c} set={set} viewSource={viewSource} />
      ) : type === 'pie' ? (
        <PieFields config={c} set={set} viewSource={viewSource} />
      ) : (
        <BarLineFields
          config={c}
          set={set}
          isHorizontal={isHorizontal}
          isLine={type === 'line'}
          viewSource={viewSource}
        />
      )}

      {type === 'aggregate' ? (
        <section className='space-y-3'>
          <SectionTitle>Estilo</SectionTitle>
          <div className='flex gap-2'>
            <TextField
              label='Prefixo'
              value={c.prefix}
              placeholder='R$'
              onChange={(prefix) => set({ prefix })}
            />
            <TextField
              label='Sufixo'
              value={c.suffix}
              placeholder='%'
              onChange={(suffix) => set({ suffix })}
            />
          </div>
          <Labeled label='Comparar com período anterior'>
            <Select
              value={c.compareRange ?? NONE}
              onValueChange={(v) =>
                set({
                  compareRange:
                    v === NONE ? undefined : (v as ChartConfig['compareRange']),
                })
              }
            >
              <SelectTrigger className='w-full'>
                <span>
                  {c.compareRange
                    ? COMPARE_RANGE_LABELS[c.compareRange]
                    : 'Nenhuma'}
                </span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {COMPARE_RANGES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {COMPARE_RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
        </section>
      ) : (
        <section className='space-y-3'>
          <SectionTitle>Estilo</SectionTitle>
          {isBarLine ? (
            <div className='flex gap-2'>
              <TextField
                label='Nome eixo X'
                value={c.xAxisName}
                onChange={(xAxisName) => set({ xAxisName })}
              />
              <TextField
                label='Nome eixo Y'
                value={c.yAxisName}
                onChange={(yAxisName) => set({ yAxisName })}
              />
            </div>
          ) : (
            <TextField
              label='Título'
              value={c.xAxisName}
              onChange={(xAxisName) => set({ xAxisName })}
            />
          )}
          {isBarLine ? (
            <Toggle
              label='Barras empilhadas'
              checked={c.stacked}
              onChange={(stacked) => set({ stacked })}
            />
          ) : null}
          <Toggle
            label='Rótulos de dados'
            checked={c.dataLabels}
            onChange={(dataLabels) => set({ dataLabels })}
          />
          <Toggle
            label='Legenda'
            checked={c.legend}
            onChange={(legend) => set({ legend })}
          />
        </section>
      )}
    </div>
  )
}

function BarLineFields({
  config: c,
  set,
  isHorizontal,
  isLine,
  viewSource,
}: {
  config: ChartConfig
  set: (patch: Partial<ChartConfig>) => void
  isHorizontal: boolean
  isLine: boolean
  viewSource: ViewSource
}) {
  const categoryAxis = isHorizontal
    ? 'Eixo Y (categorias)'
    : 'Eixo X (categorias)'
  const valueAxis = isHorizontal ? 'Eixo X (valor)' : 'Eixo Y (valor)'
  return (
    <>
      <section className='space-y-3'>
        <SectionTitle>{categoryAxis}</SectionTitle>
        <Labeled label='Campo a exibir'>
          <FieldSelect
            source={viewSource}
            value={c.xField}
            onChange={(xField) => set({ xField })}
            allowNone
            noneLabel='Selecionar campo'
          />
        </Labeled>
        <Labeled label='Ordenar por'>
          <SortModeSelect
            value={c.xSort}
            onChange={(xSort) => set({ xSort })}
          />
        </Labeled>
        <Toggle
          label='Omitir valores zero'
          checked={c.omitZero}
          onChange={(omitZero) => set({ omitZero })}
        />
      </section>

      <section className='space-y-3'>
        <SectionTitle>{valueAxis}</SectionTitle>
        <Labeled label='Campo a exibir'>
          <FieldSelect
            source={viewSource}
            value={c.yField}
            onChange={(yField) => set({ yField })}
            allowNone
            noneLabel='Contagem de registros'
          />
        </Labeled>
        <Labeled label='Agrupar por (série)'>
          <FieldSelect
            source={viewSource}
            value={c.groupBy}
            onChange={(groupBy) => set({ groupBy })}
            allowNone
            noneLabel='— sem série —'
          />
        </Labeled>
        <Labeled label='Ordenar por'>
          <SortModeSelect
            value={c.ySort}
            onChange={(ySort) => set({ ySort })}
          />
        </Labeled>
        {!isLine ? null : (
          <p className='text-muted-foreground text-xs'>
            Em linha, "empilhadas" vira área empilhada.
          </p>
        )}
        <Toggle
          label='Cumulativo'
          checked={c.cumulative}
          onChange={(cumulative) => set({ cumulative })}
        />
        <div className='flex gap-2'>
          <NumberField
            label='Mínimo'
            value={c.yMin}
            onChange={(yMin) => set({ yMin })}
          />
          <NumberField
            label='Máximo'
            value={c.yMax}
            onChange={(yMax) => set({ yMax })}
          />
        </div>
      </section>
    </>
  )
}

function PieFields({
  config: c,
  set,
  viewSource,
}: {
  config: ChartConfig
  set: (patch: Partial<ChartConfig>) => void
  viewSource: ViewSource
}) {
  return (
    <section className='space-y-3'>
      <SectionTitle>Dados</SectionTitle>
      <Labeled label='Campo a exibir (fatias)'>
        <FieldSelect
          source={viewSource}
          value={c.xField}
          onChange={(xField) => set({ xField })}
          allowNone
          noneLabel='Selecionar campo'
        />
      </Labeled>
      <Labeled label='Cada fatia representa'>
        <FieldSelect
          source={viewSource}
          value={c.yField}
          onChange={(yField) => set({ yField })}
          allowNone
          noneLabel='Contagem de registros'
        />
      </Labeled>
      <Labeled label='Ordenar por'>
        <SortModeSelect value={c.xSort} onChange={(xSort) => set({ xSort })} />
      </Labeled>
      <Toggle
        label='Esconder categoria vazia'
        checked={c.hideEmpty}
        onChange={(hideEmpty) => set({ hideEmpty })}
      />
    </section>
  )
}

function AggregateFields({
  config: c,
  set,
  viewSource,
}: {
  config: ChartConfig
  set: (patch: Partial<ChartConfig>) => void
  viewSource: ViewSource
}) {
  return (
    <section className='space-y-3'>
      <SectionTitle>Dados</SectionTitle>
      <Labeled label='Campo a exibir (valor)'>
        <FieldSelect
          source={viewSource}
          value={c.yField}
          onChange={(yField) => set({ yField })}
          allowNone
          noneLabel='Contagem de registros'
        />
      </Labeled>
    </section>
  )
}

/* ------------------------------- socials editor ----------------------------- */

function SocialsFields({
  config: c,
  set,
}: {
  config: ChartConfig
  set: (patch: Partial<ChartConfig>) => void
}) {
  const metric = ((c.yField as SocialMetric | undefined) ??
    'views') as SocialMetric
  const available = PLATFORMS_BY_METRIC[metric]

  function setMetric(next: SocialMetric) {
    const allowed = PLATFORMS_BY_METRIC[next]
    const platforms = c.platforms.filter((p) => allowed.includes(p))
    set({ yField: next, platforms })
  }

  function togglePlatform(platform: CrmSocialPlatformDTO) {
    const platforms = c.platforms.includes(platform)
      ? c.platforms.filter((p) => p !== platform)
      : [...c.platforms, platform]
    set({ platforms })
  }

  return (
    <div className='space-y-3'>
      <Labeled label='Métrica'>
        <Select
          value={metric}
          onValueChange={(v) => setMetric(v as SocialMetric)}
        >
          <SelectTrigger className='w-full'>
            <span>{SOCIAL_METRIC_LABELS[metric]}</span>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {SOCIAL_METRICS.map((m) => (
              <SelectItem key={m} value={m}>
                {SOCIAL_METRIC_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Labeled>
      <div className='space-y-1.5'>
        <span className='block text-sm'>Redes</span>
        <div className='grid grid-cols-2 gap-1.5'>
          {available.map((platform) => (
            // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox é o controle envolvido
            <label
              key={platform}
              className='flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent'
            >
              <Checkbox
                checked={c.platforms.includes(platform)}
                onCheckedChange={() => togglePlatform(platform)}
              />
              <span className='truncate'>
                {SOCIAL_PLATFORM_LABELS[platform]}
              </span>
            </label>
          ))}
        </div>
        <p className='text-muted-foreground text-xs'>
          * Sem conexão OAuth real ainda configurada — a série vem vazia até
          essa integração existir.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------- view editor ------------------------------ */

function ViewEditor({
  config,
  onChange,
}: {
  config: ViewConfig
  onChange: (config: Record<string, unknown>) => void
}) {
  const sourceFields = VIEW_SOURCE_FIELDS[config.source] ?? []

  function setSource(source: ViewSource) {
    onChange({ source, fields: [], filters: [], sort: [] })
  }
  function toggleField(key: string) {
    const fields = config.fields.includes(key)
      ? config.fields.filter((f) => f !== key)
      : [...config.fields, key]
    onChange({ ...config, fields })
  }
  function addSort() {
    const first = sourceFields[0]?.key ?? ''
    onChange({
      ...config,
      sort: [...config.sort, { field: first, direction: 'asc' }],
    })
  }
  function updateSort(
    index: number,
    patch: Partial<ViewConfig['sort'][number]>,
  ) {
    const sort = config.sort.map((s, i) =>
      i === index ? { ...s, ...patch } : s,
    )
    onChange({ ...config, sort })
  }
  function removeSort(index: number) {
    onChange({ ...config, sort: config.sort.filter((_, i) => i !== index) })
  }

  return (
    <div className='space-y-5'>
      <Labeled label='Fonte'>
        <SourceSelect value={config.source} onChange={setSource} />
      </Labeled>

      <div className='space-y-2'>
        <span className='block font-medium text-sm'>Campos</span>
        <p className='text-muted-foreground text-xs'>
          Nenhum selecionado = mostra todos.
        </p>
        <div className='grid grid-cols-2 gap-1.5'>
          {sourceFields.map((field) => (
            // biome-ignore lint/a11y/noLabelWithoutControl: o Checkbox é o controle envolvido
            <label
              key={field.key}
              className='flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent'
            >
              <Checkbox
                checked={config.fields.includes(field.key)}
                onCheckedChange={() => toggleField(field.key)}
              />
              <span className='truncate'>{field.label}</span>
            </label>
          ))}
        </div>
      </div>

      <FilterEditor
        source={config.source}
        filters={config.filters}
        onChange={(filters) => onChange({ ...config, filters })}
      />

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <span className='font-medium text-sm'>Ordenação</span>
          <Button variant='outline' size='sm' onClick={addSort}>
            + Ordenação
          </Button>
        </div>
        {config.sort.length === 0 ? (
          <p className='text-muted-foreground text-xs'>Sem ordenação.</p>
        ) : (
          <div className='space-y-2'>
            {config.sort.map((sort, index) => (
              <div key={`${sort.field}-${index}`} className='flex gap-1.5'>
                <div className='flex-1'>
                  <FieldSelect
                    source={config.source}
                    value={sort.field}
                    onChange={(v) => updateSort(index, { field: v ?? '' })}
                  />
                </div>
                <Select
                  value={sort.direction}
                  onValueChange={(v) =>
                    updateSort(index, { direction: v as 'asc' | 'desc' })
                  }
                >
                  <SelectTrigger size='sm' className='w-24'>
                    <span>{sort.direction === 'asc' ? 'Asc' : 'Desc'}</span>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value='asc'>Asc</SelectItem>
                    <SelectItem value='desc'>Desc</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => removeSort(index)}
                  aria-label='Remover ordenação'
                >
                  <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ iframe editor ------------------------------ */

function IframeEditor({
  config,
  onChange,
}: {
  config: IframeConfig
  onChange: (config: Record<string, unknown>) => void
}) {
  return (
    <div className='space-y-1.5'>
      <Label htmlFor='iframe-url'>URL</Label>
      <Input
        id='iframe-url'
        value={config.url ?? ''}
        placeholder='https://exemplo.com/embed'
        onChange={(e) => onChange({ ...config, url: e.target.value })}
      />
      <p className='text-muted-foreground text-xs'>
        A página será incorporada num iframe. Só URLs https são aceitas.
      </p>
    </div>
  )
}

/* ----------------------------- rich text editor ---------------------------- */

function RichTextEditor({
  config,
  onEdit,
}: {
  config: RichTextConfig
  onEdit: () => void
}) {
  const preview = (config.html ?? '').replace(/<[^>]+>/g, ' ').trim()
  return (
    <div className='space-y-2'>
      <span className='block font-medium text-sm'>Conteúdo</span>
      <div
        className={cn(
          'min-h-20 rounded-md border border-border/70 bg-muted/30 p-3 text-sm',
          !preview && 'text-muted-foreground',
        )}
      >
        {preview ? (
          <span className='line-clamp-4'>{preview}</span>
        ) : (
          'Nenhum conteúdo ainda.'
        )}
      </div>
      <Button variant='outline' size='sm' onClick={onEdit}>
        Editar conteúdo
      </Button>
    </div>
  )
}
