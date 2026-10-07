'use client'

import { ResponsiveLine } from '@nivo/line'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatUsd, formatUsdTick } from './usage-format'

/*
 * Chart colors of the Steel AI usage pages (dataviz method, emphasis form):
 * the user's own spend is the accent (blue), the workspace is de-emphasis
 * gray and the available amount is a dashed reference line in secondary
 * ink. Validated with the dataviz validator against the app surfaces in
 * both themes (blue ↔ gray: CVD ΔE 15.9, normal ΔE 17+, both >= 3:1; the
 * gray is intentionally achromatic — it is the de-emphasis slot, not a
 * categorical hue). Values are CSS variables so dark mode swaps steps.
 * Text never wears these colors: identity comes from the swatch beside it.
 */
export const VIZ = {
  mine: 'var(--viz-mine)',
  workspace: 'var(--viz-workspace)',
  limit: 'var(--viz-limit)',
} as const

/** Put on the page root: defines the chart color variables per theme. */
export const VIZ_VARS =
  '[--viz-mine:#2a78d6] [--viz-workspace:#898781] [--viz-limit:#52514e] dark:[--viz-mine:#3987e5] dark:[--viz-workspace:#898781] dark:[--viz-limit:#c3c2b7]'

const THEME = {
  text: { fill: 'currentColor', fontSize: 11 },
  axis: {
    ticks: { text: { fill: 'currentColor' }, line: { stroke: 'transparent' } },
    domain: { line: { stroke: 'currentColor', strokeOpacity: 0.15 } },
  },
  grid: { line: { stroke: 'currentColor', strokeOpacity: 0.08 } },
  crosshair: { line: { stroke: 'currentColor', strokeOpacity: 0.35 } },
} as const

export interface UsageLineSeries {
  id: string
  label: string
  color: string
  dashed?: boolean
  /** One value per x position; `null` = no point there (future days). */
  values: (number | null)[]
}

export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className='inline-block h-0.5 w-3.5 shrink-0 rounded-full'
      style={
        dashed
          ? {
              backgroundImage: `linear-gradient(90deg, ${color} 55%, transparent 55%)`,
              backgroundSize: '5px 2px',
            }
          : { backgroundColor: color }
      }
    />
  )
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[]
}) {
  return (
    <ul className='flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs'>
      {items.map((item) => (
        <li key={item.label} className='inline-flex items-center gap-1.5'>
          <Swatch color={item.color} dashed={item.dashed} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Cumulative spend over a period (nivo line, one US$ axis). Crosshair +
 * tooltip lists every series at the hovered day; dashed series draw a
 * reference (limit) or a projection.
 */
export function UsageLineChart({
  labels,
  tooltipLabels,
  series,
  ariaLabel,
  className = 'h-56',
}: {
  /** Short x-axis labels, one per position. */
  labels: string[]
  /** Long labels for the tooltip title. */
  tooltipLabels: string[]
  series: UsageLineSeries[]
  ariaLabel: string
  className?: string
}) {
  const every = Math.max(1, Math.ceil(labels.length / 8))
  const dashed = new Set(series.filter((s) => s.dashed).map((s) => s.id))
  const names = new Map(series.map((s) => [s.id, s.label]))

  return (
    <div className={cn('min-w-0 text-muted-foreground', className)}>
      <ResponsiveLine
        data={series.map((s) => ({
          id: s.id,
          color: s.color,
          data: s.values.map((y, i) => ({ x: `${i}`, y })),
        }))}
        margin={{ top: 10, right: 12, bottom: 26, left: 64 }}
        colors={(s) => s.color as string}
        curve='linear'
        lineWidth={2}
        pointSize={0}
        enableSlices='x'
        enableGridX={false}
        yScale={{ type: 'linear', min: 0, max: 'auto' }}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: labels
            .map((_, i) => `${i}`)
            .filter((_, i) => i % every === 0),
          format: (v) => labels[Number(v)] ?? '',
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: 4,
          format: (v) => formatUsdTick(Number(v)),
        }}
        layers={[
          'grid',
          'axes',
          ({ series: drawn, lineGenerator }) => (
            <g>
              {drawn.map((s) => (
                <path
                  key={s.id}
                  d={lineGenerator(s.data.map((d) => d.position)) ?? undefined}
                  fill='none'
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeDasharray={dashed.has(String(s.id)) ? '5 4' : undefined}
                />
              ))}
            </g>
          ),
          'crosshair',
          'slices',
        ]}
        sliceTooltip={({ slice }) => (
          <div className='min-w-44 rounded-md border border-border bg-popover px-2.5 py-2 text-popover-foreground text-xs shadow-sm'>
            <p className='mb-1 font-medium'>
              {tooltipLabels[Number(slice.points[0]?.data.x)] ?? ''}
            </p>
            {slice.points.map((point) => (
              <p key={point.id} className='flex items-center gap-2'>
                <Swatch
                  color={point.seriesColor}
                  dashed={dashed.has(String(point.seriesId))}
                />
                <span className='text-muted-foreground'>
                  {names.get(String(point.seriesId)) ?? point.seriesId}
                </span>
                <span className='ml-auto pl-3 font-medium tabular-nums'>
                  {formatUsd(Number(point.data.y))}
                </span>
              </p>
            ))}
          </div>
        )}
        theme={THEME}
        role='img'
        ariaLabel={ariaLabel}
      />
    </div>
  )
}

/** Stat tile: label · value · optional detail (delta or context). */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
}) {
  return (
    <div className='min-w-0 rounded-xl border border-border/80 bg-card px-4 py-3'>
      <p className='truncate text-muted-foreground text-xs'>{label}</p>
      <p className='mt-1 truncate font-semibold text-xl'>{value}</p>
      {detail ? (
        <p className='mt-0.5 text-muted-foreground text-xs'>{detail}</p>
      ) : null}
    </div>
  )
}

export function ChartSkeleton({ className = 'h-56' }: { className?: string }) {
  return (
    <div aria-hidden data-testid='usage-chart-skeleton'>
      <Skeleton className={cn('w-full rounded-lg', className)} />
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className='flex min-h-32 items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm'>
      {children}
    </div>
  )
}

/**
 * Horizontal bars (HTML) for one breakdown, most expensive first. The value
 * and share sit beside each bar, so the list is also its own table view.
 */
export function BreakdownBars({
  items,
  label,
  empty = 'Sem consumo no período.',
}: {
  items: {
    key: string
    label: string
    detail: string | null
    costUsd: number
    share: number
    calls: number
  }[]
  label: string
  empty?: string
}) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>
  const max = Math.max(...items.map((i) => i.costUsd), 0.000001)
  return (
    <ul aria-label={label} className='space-y-2.5'>
      {items.map((item) => (
        <li key={item.key} className='space-y-1'>
          <div className='flex min-w-0 items-baseline gap-2 text-sm'>
            <span className='min-w-0 flex-1 truncate' title={item.label}>
              {item.label}
              {item.detail ? (
                <span className='ml-1.5 text-muted-foreground text-xs'>
                  {item.detail}
                </span>
              ) : null}
            </span>
            <span className='shrink-0 font-medium tabular-nums'>
              {formatUsd(item.costUsd)}
            </span>
            <span className='w-12 shrink-0 text-right text-muted-foreground text-xs tabular-nums'>
              {(item.share * 100).toLocaleString('pt-BR', {
                maximumFractionDigits: 1,
              })}
              %
            </span>
          </div>
          <div className='h-2 w-full rounded-sm bg-muted' aria-hidden>
            <div
              className='h-full rounded-r-sm'
              style={{
                width: `${Math.max(1, (item.costUsd / max) * 100)}%`,
                backgroundColor: VIZ.mine,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
