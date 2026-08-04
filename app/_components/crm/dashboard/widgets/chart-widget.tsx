'use client'

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import * as React from 'react'
import {
  aggregateChart,
  aggregateCompare,
  aggregateTotal,
  type Row,
  withDerivedFields,
} from '@/app/_components/crm/dashboard/widget-data'
import { sourceResource } from '@/app/_components/crm/dashboard/widget-meta'
import { SteelIcon } from '@/components/icon/icon'
import { useResourceList } from '@/src/hooks/use-crm-resource-list'
import type { ChartConfig } from '@/src/schemas/crm-dashboard.schema'

const COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#a855f7',
]

/** Tema nivo que herda a cor do texto do container (claro/escuro). */
const THEME = {
  text: { fill: 'currentColor', fontSize: 11 },
  axis: {
    ticks: { text: { fill: 'currentColor' }, line: { stroke: 'transparent' } },
    legend: { text: { fill: 'currentColor', fontSize: 11 } },
    domain: { line: { stroke: 'currentColor', strokeOpacity: 0.15 } },
  },
  grid: { line: { stroke: 'currentColor', strokeOpacity: 0.08 } },
  legends: { text: { fill: 'currentColor' } },
  tooltip: {
    container: {
      background: 'var(--color-popover)',
      color: 'var(--color-popover-foreground)',
      fontSize: 12,
    },
  },
} as const

function Empty({ message }: { message: string }) {
  return (
    <div className='flex h-full items-center justify-center px-3 text-center text-muted-foreground text-sm'>
      {message}
    </div>
  )
}

/**
 * Sem OAuth real por plataforma (ver Fase 13 do plano), o Steel não coleta
 * métricas sociais — a fonte "socials" sempre retorna uma série vazia. O
 * widget fica funcional na UI (não quebra), só sem dado até essa integração
 * existir.
 */
function useChartRows(
  workspaceId: string,
  source: ChartConfig['source'],
): {
  items: Row[]
  isLoading: boolean
} {
  const path = source === 'socials' ? '' : sourceResource(source)
  const { items, isLoading } = useResourceList<Row>(
    workspaceId,
    path || 'crm/companies',
  )
  const derived = React.useMemo(
    () => withDerivedFields(source, items),
    [source, items],
  )
  if (source === 'socials') return { items: [], isLoading: false }
  return { items: derived, isLoading }
}

export function ChartWidget({
  workspaceId,
  config,
}: {
  workspaceId: string
  config: ChartConfig
}) {
  const { items, isLoading } = useChartRows(workspaceId, config.source)

  const data = React.useMemo(
    () => aggregateChart(items, config),
    [items, config],
  )
  const total = React.useMemo(
    () => aggregateTotal(items, config),
    [items, config],
  )
  const compare = React.useMemo(
    () => aggregateCompare(items, config),
    [items, config],
  )

  if (isLoading) return <Empty message='Carregando…' />

  if (config.source === 'socials' && config.platforms.length === 0) {
    return <Empty message='Selecione ao menos uma rede no painel.' />
  }
  if (config.source === 'socials') {
    return (
      <Empty message='Sem métricas sociais disponíveis (conexão via OAuth ainda não configurada).' />
    )
  }

  /* -------------------------------- aggregate ------------------------------ */
  if (config.chartType === 'aggregate') {
    const displayValue = compare ? compare.current : total
    const formatted = new Intl.NumberFormat('pt-BR').format(displayValue)
    const changePct = compare?.changePct ?? null
    const isUp = changePct !== null && changePct >= 0
    return (
      <div className='flex h-full flex-col items-center justify-center text-muted-foreground'>
        <span className='font-heading font-semibold text-4xl text-foreground tabular-nums'>
          {config.prefix}
          {formatted}
          {config.suffix}
        </span>
        {config.xAxisName ? (
          <span className='mt-1 text-xs uppercase tracking-wide'>
            {config.xAxisName}
          </span>
        ) : null}
        {changePct !== null ? (
          <span
            className={
              'mt-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium text-xs ' +
              (isUp
                ? 'bg-emerald-500/15 text-emerald-600'
                : 'bg-rose-500/15 text-rose-600')
            }
          >
            <SteelIcon
              icon={isUp ? ArrowUp01Icon : ArrowDown01Icon}
              className='size-3'
            />
            {new Intl.NumberFormat('pt-BR', {
              maximumFractionDigits: 1,
            }).format(Math.abs(changePct))}
            %
          </span>
        ) : null}
      </div>
    )
  }

  if (!config.xField) {
    return (
      <Empty message='Escolha o campo a exibir na customização do gráfico.' />
    )
  }
  if (data.categories.length === 0) {
    return <Empty message='Sem dados para os filtros atuais.' />
  }

  const isHorizontal = config.chartType === 'horizontal'
  const categoryLegend = config.xAxisName || undefined
  const valueLegend = config.yAxisName || undefined
  /** Nome do eixo que fica embaixo/à esquerda (barra horizontal inverte os dois). */
  const bottomAxisName = isHorizontal ? valueLegend : categoryLegend
  const leftAxisName = isHorizontal ? categoryLegend : valueLegend

  /*
   * O espaço embaixo do gráfico é compartilhado por até três elementos
   * empilhados: tick labels do eixo X, o nome do eixo (axisBottom.legend) e
   * a legenda de série (chart legend). O espaço à esquerda é compartilhado
   * por tick labels do eixo Y e o nome do eixo (axisLeft.legend). Cada faixa
   * reserva sua própria altura/largura e os offsets abaixo são derivados
   * dela, para nunca ultrapassar a margem reservada (o que antes causava
   * sobreposição/corte de texto).
   */
  const TICK_SPACE_X = 24
  const AXIS_NAME_SPACE_X = 20
  const SERIES_LEGEND_SPACE = 24
  const TICK_SPACE_Y = 32
  const AXIS_NAME_SPACE_Y = 20

  const bottomMargin =
    TICK_SPACE_X +
    (bottomAxisName ? AXIS_NAME_SPACE_X : 0) +
    (config.legend ? SERIES_LEGEND_SPACE : 0)
  const axisBottomLegendOffset = TICK_SPACE_X + AXIS_NAME_SPACE_X / 2 + 4
  const seriesLegendTranslateY =
    TICK_SPACE_X + (bottomAxisName ? AXIS_NAME_SPACE_X : 0) + 6

  const leftMargin = TICK_SPACE_Y + (leftAxisName ? AXIS_NAME_SPACE_Y : 0)
  const axisLeftLegendOffset = -(TICK_SPACE_Y + AXIS_NAME_SPACE_Y / 2 + 4)

  const legends = config.legend
    ? [
        {
          dataFrom: 'keys' as const,
          anchor: 'bottom' as const,
          direction: 'row' as const,
          translateY: seriesLegendTranslateY,
          itemWidth: 80,
          itemHeight: 16,
          symbolSize: 10,
        },
      ]
    : []

  /* ---------------------------------- pie ---------------------------------- */
  if (config.chartType === 'pie') {
    const pieData = data.categories.map((category) => ({
      id: category,
      value: data.totalOf(category),
    }))
    const PIE_LEGEND_TRANSLATE_Y = 32
    const PIE_LEGEND_HEIGHT = 16
    const pieBottomMargin = config.legend
      ? PIE_LEGEND_TRANSLATE_Y + PIE_LEGEND_HEIGHT + 8
      : 12
    return (
      <div className='h-full w-full text-muted-foreground'>
        <ResponsivePie
          data={pieData}
          margin={{
            top: 12,
            right: 12,
            bottom: pieBottomMargin,
            left: 12,
          }}
          innerRadius={0.5}
          padAngle={1}
          cornerRadius={3}
          colors={COLORS}
          borderWidth={0}
          enableArcLinkLabels={false}
          enableArcLabels={config.dataLabels}
          arcLabelsTextColor='#fff'
          theme={THEME}
          legends={
            config.legend
              ? [
                  {
                    anchor: 'bottom',
                    direction: 'row',
                    translateY: PIE_LEGEND_TRANSLATE_Y,
                    itemWidth: 70,
                    itemHeight: PIE_LEGEND_HEIGHT,
                    symbolSize: 10,
                  },
                ]
              : []
          }
        />
      </div>
    )
  }

  /* ---------------------------------- line --------------------------------- */
  if (config.chartType === 'line') {
    const lineData = data.seriesKeys.map((series) => ({
      id: series,
      data: data.categories.map((category) => ({
        x: category,
        y: data.valueAt(category, series),
      })),
    }))
    return (
      <div className='h-full w-full text-muted-foreground'>
        <ResponsiveLine
          data={lineData}
          margin={{
            top: 12,
            right: 16,
            bottom: bottomMargin,
            left: leftMargin,
          }}
          colors={COLORS}
          curve='monotoneX'
          enableArea={config.stacked}
          areaOpacity={0.15}
          pointSize={6}
          pointColor={{ from: 'color' }}
          useMesh
          yScale={{
            type: 'linear',
            min: config.yMin ?? 'auto',
            max: config.yMax ?? 'auto',
            stacked: config.stacked,
          }}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            legend: bottomAxisName,
            legendPosition: 'middle',
            legendOffset: axisBottomLegendOffset,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            legend: leftAxisName,
            legendPosition: 'middle',
            legendOffset: axisLeftLegendOffset,
          }}
          theme={THEME}
          legends={legends}
        />
      </div>
    )
  }

  /* ------------------------------- bar (v / h) ----------------------------- */
  const barData = data.categories.map((category) => {
    const entry: Record<string, string | number> = { category }
    for (const series of data.seriesKeys) {
      entry[series] = data.valueAt(category, series)
    }
    return entry
  })

  return (
    <div className='h-full w-full text-muted-foreground'>
      <ResponsiveBar
        data={barData}
        keys={data.seriesKeys}
        indexBy='category'
        layout={isHorizontal ? 'horizontal' : 'vertical'}
        groupMode={config.stacked ? 'stacked' : 'grouped'}
        margin={{ top: 12, right: 16, bottom: bottomMargin, left: leftMargin }}
        padding={0.3}
        colors={COLORS}
        borderRadius={3}
        enableLabel={config.dataLabels}
        valueScale={{
          type: 'linear',
          min: config.yMin ?? 'auto',
          max: config.yMax ?? 'auto',
        }}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          legend: bottomAxisName,
          legendPosition: 'middle',
          legendOffset: axisBottomLegendOffset,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          legend: leftAxisName,
          legendPosition: 'middle',
          legendOffset: axisLeftLegendOffset,
        }}
        theme={THEME}
        legends={legends}
      />
    </div>
  )
}
