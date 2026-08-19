'use client'

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/src/hooks/_fetch'
import type {
  CrmCompetitorMetricSnapshotDTO,
  CrmCompetitorMetricsDTO,
} from '@/types/crm-competitor'

const nf = new Intl.NumberFormat('pt-BR')

const RANGE_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
] as const

/** Polyline SVG leve — sem lib de gráfico só para uma série de seguidores. */
function Sparkline({
  snapshots,
}: {
  snapshots: CrmCompetitorMetricSnapshotDTO[]
}) {
  if (snapshots.length < 2) return null

  const values = snapshots.map((s) => s.followersCount)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 240
  const height = 48

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className='h-12 w-full text-primary'
      preserveAspectRatio='none'
      role='img'
      aria-label='Evolução de seguidores no período'
    >
      <polyline
        points={points}
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function GrowthBadge({
  growth,
}: {
  growth: CrmCompetitorMetricsDTO['competitor']['growth']
}) {
  if (!growth) return null
  const isPositive = growth.absolute >= 0
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium tabular-nums ${
        isPositive ? 'text-emerald-600' : 'text-destructive'
      }`}
    >
      <SteelIcon
        icon={isPositive ? ArrowUp01Icon : ArrowDown01Icon}
        size={12}
      />
      {nf.format(Math.abs(growth.absolute))}
      {growth.percent !== null && (
        <span className='text-muted-foreground'>
          ({isPositive ? '+' : '-'}
          {Math.abs(growth.percent).toFixed(1)}%)
        </span>
      )}
    </span>
  )
}

function StatBlock({
  title,
  series,
}: {
  title: string
  series: CrmCompetitorMetricsDTO['competitor']
}) {
  return (
    <Card size='sm' className='gap-2 p-4'>
      <p className='text-muted-foreground text-xs'>{title}</p>
      <div className='flex items-baseline gap-2'>
        <p className='font-semibold text-xl tabular-nums'>
          {series.followersCount !== null
            ? nf.format(series.followersCount)
            : '—'}
        </p>
        <GrowthBadge growth={series.growth} />
      </div>
      <Sparkline snapshots={series.snapshots} />
    </Card>
  )
}

/**
 * Comparação "nós vs. concorrente": seguidores atuais, variação no período e
 * série histórica — depende do job diário `CrmCompetitorSync` já ter gerado
 * snapshots (ver `src/lib/queue/processors/crm-competitor-sync.ts`).
 */
export function CrmCompetitorMetricsPanel({
  workspaceId,
  competitorId,
}: {
  workspaceId: string
  competitorId: string
}) {
  const [range, setRange] =
    useState<(typeof RANGE_OPTIONS)[number]['value']>('30d')
  const [metrics, setMetrics] = useState<CrmCompetitorMetricsDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    apiFetch<CrmCompetitorMetricsDTO>(
      `/api/workspaces/${workspaceId}/crm/competitors/${competitorId}/metrics?range=${range}`,
      undefined,
      'Não foi possível carregar as métricas.',
    )
      .then((data) => {
        if (!cancelled) setMetrics(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar as métricas.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, competitorId, range])

  return (
    <div className='space-y-3 border-t p-4'>
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-medium'>Comparação com concorrente</h4>
        <Select
          value={range}
          onValueChange={(value) => setRange(value as typeof range)}
        >
          <SelectTrigger size='sm' className='w-28'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <p className='text-muted-foreground text-xs'>Carregando…</p>
      )}
      {error && <p className='text-destructive text-xs'>{error}</p>}

      {metrics && !isLoading && (
        <>
          <div className='grid grid-cols-2 gap-3'>
            <StatBlock title='Concorrente' series={metrics.competitor} />
            {metrics.ownAccount ? (
              <StatBlock
                title={metrics.ownAccount.accountName ?? 'Sua conta'}
                series={metrics.ownAccount}
              />
            ) : (
              <Card size='sm' className='flex items-center justify-center p-4'>
                <p className='text-muted-foreground text-center text-xs'>
                  Conecte uma conta desta plataforma para comparar
                </p>
              </Card>
            )}
          </div>
          {metrics.competitor.snapshots.length === 0 && (
            <p className='text-muted-foreground text-xs'>
              Ainda sem histórico — o sync automático roda uma vez por dia.
            </p>
          )}
        </>
      )}
    </div>
  )
}
