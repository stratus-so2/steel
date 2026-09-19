'use client'

import { ResponsiveLine } from '@nivo/line'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { AnalyticsRange } from '@/src/schemas/admin-analytics.schema'
import { ErrorState, formatNumber } from '../shell/admin-ui'

/*
 * Peças visuais do painel Analytics. Cores fixas por série (validadas para
 * CVD e contraste nos temas claro e escuro com o validador do dataviz):
 * requisições = índigo, 4xx = âmbar, 5xx = fúcsia; latência p50/p95/p99 =
 * teal/âmbar/fúcsia; usuários/workspaces = índigo/teal. Texto sempre nas
 * cores de texto do tema — a cor da série fica no traço/amostra.
 */
export const COLOR = {
  requests: '#6366f1',
  e4: '#d97706',
  e5: '#c026d3',
  p50: '#0d9488',
  p95: '#d97706',
  p99: '#c026d3',
  users: '#6366f1',
  workspaces: '#0d9488',
} as const

const THEME = {
  text: { fill: 'currentColor', fontSize: 11 },
  axis: {
    ticks: { text: { fill: 'currentColor' }, line: { stroke: 'transparent' } },
    domain: { line: { stroke: 'currentColor', strokeOpacity: 0.15 } },
  },
  grid: { line: { stroke: 'currentColor', strokeOpacity: 0.08 } },
  crosshair: { line: { stroke: 'currentColor', strokeOpacity: 0.35 } },
  tooltip: {
    container: {
      background: 'var(--color-popover)',
      color: 'var(--color-popover-foreground)',
      fontSize: 12,
    },
  },
} as const

const TZ = 'America/Sao_Paulo'
const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})
const dayHourFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  timeZone: TZ,
})

/** Rótulo do eixo X pelo intervalo (hora curta ou dia + hora). */
export function timeLabel(iso: string, range: AnalyticsRange): string {
  const date = new Date(iso)
  return range === '7d' || range === '30d'
    ? `${dayHourFormat.format(date)}h`
    : timeFormat.format(date)
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (value >= 1000)
    return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s`
  return `${Math.round(value).toLocaleString('pt-BR')} ms`
}

export function formatPercent(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className='inline-block h-0.5 w-3 rounded-full'
      style={
        dashed
          ? {
              backgroundImage: `linear-gradient(90deg, ${color} 60%, transparent 60%)`,
              backgroundSize: '4px 2px',
            }
          : { backgroundColor: color }
      }
    />
  )
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[]
}) {
  return (
    <div className='flex flex-wrap gap-3 text-muted-foreground text-xs'>
      {items.map((item) => (
        <span key={item.label} className='inline-flex items-center gap-1.5'>
          <Swatch color={item.color} dashed={item.dashed} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function EmptyChart({
  message = 'Sem eventos no período.',
}: {
  message?: string
}) {
  return (
    <div className='flex h-full items-center justify-center px-3 text-center text-muted-foreground text-sm'>
      {message}
    </div>
  )
}

export interface SeriesSpec<T> {
  id: string
  color: string
  value: (point: T) => number | null
  dashed?: boolean
}

/**
 * Série temporal (nivo) com crosshair + tooltip de todas as séries do balde.
 * Um eixo só: medidas de escalas diferentes vão em gráficos separados.
 */
export function TimeSeriesChart<T extends { t: string }>({
  points,
  series,
  range,
  format = (v) => formatNumber(Math.round(v)),
  ariaLabel,
  className = 'h-52',
}: {
  points: T[]
  series: SeriesSpec<T>[]
  range: AnalyticsRange
  format?: (value: number) => string
  ariaLabel: string
  className?: string
}) {
  const hasData = points.some((p) => series.some((s) => (s.value(p) ?? 0) > 0))
  const ticks = Math.max(1, Math.ceil(points.length / 6))
  const labels = points.map((p) => timeLabel(p.t, range))
  const dashed = new Set(series.filter((s) => s.dashed).map((s) => s.id))

  return (
    <div className={cn('min-w-0 text-muted-foreground', className)}>
      {hasData ? (
        <ResponsiveLine
          data={series.map((s) => ({
            id: s.id,
            color: s.color,
            data: points.map((p, i) => ({ x: `${i}`, y: s.value(p) })),
          }))}
          margin={{ top: 10, right: 12, bottom: 26, left: 52 }}
          colors={(s) => s.color as string}
          curve='monotoneX'
          lineWidth={2}
          pointSize={0}
          enableSlices='x'
          enableGridX={false}
          yScale={{ type: 'linear', min: 0, max: 'auto' }}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickValues: points
              .map((_, i) => `${i}`)
              .filter((_, i) => i % ticks === 0),
            format: (v) => labels[Number(v)] ?? '',
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickValues: 4,
            format: (v) => format(Number(v)),
          }}
          layers={[
            'grid',
            'axes',
            ({ series: drawn, lineGenerator }) => (
              <g>
                {drawn.map((s) => (
                  <path
                    key={s.id}
                    d={
                      lineGenerator(s.data.map((d) => d.position)) ?? undefined
                    }
                    fill='none'
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray={
                      dashed.has(String(s.id)) ? '5 4' : undefined
                    }
                  />
                ))}
              </g>
            ),
            'crosshair',
            'slices',
          ]}
          sliceTooltip={({ slice }) => (
            <div className='rounded-md border border-border bg-popover px-2.5 py-2 text-popover-foreground text-xs shadow-sm'>
              <p className='mb-1 font-medium'>
                {labels[Number(slice.points[0]?.data.x)] ?? ''}
              </p>
              {slice.points.map((point) => (
                <p key={point.id} className='flex items-center gap-2'>
                  <Swatch color={point.seriesColor} />
                  <span className='text-muted-foreground'>
                    {point.seriesId}
                  </span>
                  <span className='ml-auto font-mono tabular-nums'>
                    {point.data.y === null ? '—' : format(Number(point.data.y))}
                  </span>
                </p>
              ))}
            </div>
          )}
          theme={THEME}
          role='img'
          ariaLabel={ariaLabel}
        />
      ) : (
        <EmptyChart />
      )}
    </div>
  )
}

/** Ranking em barras horizontais (HTML) — denso, legível e acessível. */
export function BarList({
  items,
  color = COLOR.requests,
  format = formatNumber,
  empty = 'Sem dados no período.',
  label,
}: {
  items: { key: string; label: ReactNode; value: number; title?: string }[]
  color?: string
  format?: (n: number) => string
  empty?: string
  label: string
}) {
  if (items.length === 0) {
    return (
      <p className='px-1 py-6 text-center text-muted-foreground text-sm'>
        {empty}
      </p>
    )
  }
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul aria-label={label} className='space-y-1'>
      {items.map((item) => (
        <li
          key={item.key}
          className='relative flex h-7 items-center gap-2 px-2 text-xs'
          title={item.title}
        >
          <span
            aria-hidden
            className='absolute inset-y-0.5 left-0 rounded-sm opacity-15'
            style={{
              width: `${(item.value / max) * 100}%`,
              backgroundColor: color,
            }}
          />
          <span className='relative min-w-0 flex-1 truncate'>{item.label}</span>
          <span className='relative font-mono tabular-nums'>
            {format(item.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Painel que pode ter falhado sozinho (consulta do Axiom). */
export function PanelBody<T>({
  panel,
  children,
}: {
  panel: { ok: true; data: T } | { ok: false; error: string }
  children: (data: T) => ReactNode
}) {
  if (!panel.ok) {
    return (
      <ErrorState
        message={`Não foi possível carregar este painel: ${panel.error}`}
      />
    )
  }
  return <>{children(panel.data)}</>
}
