'use client'

import { useState } from 'react'
import { SteelAiTopBar } from '@/app/_components/steel-ai/steel-ai-top-bar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAiUsageOverview } from '@/src/hooks/use-ai-usage'
import type {
  AiUsageCumulativePointDTO,
  AiUsageOverviewDTO,
  AiUsagePeriodSummaryDTO,
} from '@/types/ai-usage'
import {
  ChartLegend,
  ChartSkeleton,
  StatTile,
  UsageLineChart,
  type UsageLineSeries,
  VIZ,
  VIZ_VARS,
} from './usage-charts'
import {
  formatChange,
  formatDayMonth,
  formatLongDay,
  formatMonthYear,
  formatRange,
  formatShare,
  formatUsd,
  formatWeekday,
} from './usage-format'

const DAY_MS = 24 * 60 * 60 * 1000

/** Every UTC day of a period (`YYYY-MM-DD`). */
function periodDays(period: AiUsagePeriodSummaryDTO): string[] {
  const start = new Date(period.start).getTime()
  return Array.from({ length: period.days }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  )
}

function xLabels(period: AiUsagePeriodSummaryDTO, days: string[]): string[] {
  return period.kind === 'week'
    ? days.map(formatWeekday)
    : days.map((d) => String(Number(d.slice(8))))
}

/** Values of a cumulative series padded with `null` up to `length`. */
function pad(
  points: AiUsageCumulativePointDTO[],
  pick: (p: AiUsageCumulativePointDTO) => number,
  length: number,
): (number | null)[] {
  return Array.from({ length }, (_, i) =>
    i < points.length ? pick(points[i]) : null,
  )
}

/** `/ai/usage` — the user's AI spend vs the workspace quota. */
export function AiUsageOverview({ workspaceId }: { workspaceId: string }) {
  const overview = useAiUsageOverview(workspaceId)

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col', VIZ_VARS)}>
      <SteelAiTopBar title='Uso' />
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <div className='mx-auto w-full max-w-4xl space-y-5 px-4 pt-2 pb-10 sm:px-6 sm:pt-4'>
          <header className='space-y-1'>
            <h1 className='font-semibold text-lg'>Uso</h1>
            <p className='max-w-prose text-muted-foreground text-sm'>
              Quanto você gastou com IA neste espaço de trabalho, em dólar
              (US$), pelo preço real de cada modelo. Dias, semanas e meses
              seguem o horário UTC, o mesmo da cota.
            </p>
          </header>
          {overview.isLoading ? (
            <OverviewSkeleton />
          ) : overview.data ? (
            <OverviewBody data={overview.data} />
          ) : (
            <p className='text-destructive text-sm'>
              {overview.error instanceof Error
                ? overview.error.message
                : 'Não foi possível carregar o consumo de IA.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className='space-y-5' data-testid='usage-overview-loading'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        {[0, 1, 2, 3].map((key) => (
          <ChartSkeleton key={key} className='h-20' />
        ))}
      </div>
      <ChartSkeleton className='h-72' />
    </div>
  )
}

export function OverviewBody({ data }: { data: AiUsageOverviewDTO }) {
  const { month, week } = data
  const myShare =
    month.workspaceUsd > 0 ? month.mineUsd / month.workspaceUsd : 0
  const remaining = Math.max(0, data.monthlyQuotaUsd - month.workspaceUsd)

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatTile
          label='Você neste mês'
          value={formatUsd(month.mineUsd)}
          detail={`${formatShare(myShare)} do gasto do espaço`}
        />
        <StatTile
          label='Espaço de trabalho no mês'
          value={formatUsd(month.workspaceUsd)}
          detail={`de ${formatUsd(data.monthlyQuotaUsd)} da cota mensal`}
        />
        <StatTile
          label='Restante da cota'
          value={formatUsd(remaining)}
          detail='compartilhado por todos os membros'
        />
        <StatTile
          label='Você nesta semana'
          value={formatUsd(week.mineUsd)}
          detail={`parcela semanal: ${formatUsd(data.weeklyShareUsd)}`}
        />
      </div>

      <PeriodCard
        period={month}
        title={`Mês · ${formatMonthYear(month.start)}`}
        description='Gasto acumulado dia a dia. Não há limite por pessoa: a cota mensal é do espaço de trabalho inteiro e vale para todos os membros e automações.'
        limitLabel='Cota mensal do espaço (compartilhada)'
      />
      <PeriodCard
        period={week}
        title={`Semana · ${formatRange(week.start, week.end)}`}
        description={`Segunda a domingo (UTC). A parcela semanal é a cota mensal proporcional a 7 dias: ${formatUsd(data.monthlyQuotaUsd)} × 7 ÷ ${month.days} dias do mês = ${formatUsd(data.weeklyShareUsd)}. É uma referência de ritmo, não um bloqueio.`}
        limitLabel='Parcela semanal da cota'
      />
      <TrendCard data={data} />
    </div>
  )
}

function PeriodCard({
  period,
  title,
  description,
  limitLabel,
}: {
  period: AiUsagePeriodSummaryDTO
  title: string
  description: string
  limitLabel: string
}) {
  const days = periodDays(period)
  const series: UsageLineSeries[] = [
    {
      id: 'mine',
      label: 'Você',
      color: VIZ.mine,
      values: pad(period.points, (p) => p.mineUsd, days.length),
    },
    {
      id: 'workspace',
      label: 'Espaço de trabalho (todos)',
      color: VIZ.workspace,
      values: pad(period.points, (p) => p.workspaceUsd, days.length),
    },
    {
      id: 'limit',
      label: limitLabel,
      color: VIZ.limit,
      dashed: true,
      values: days.map(() => period.limitUsd),
    },
  ]
  const kindLabel = period.kind === 'week' ? 'semana' : 'mês'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <ChartLegend items={series} />
        <UsageLineChart
          labels={xLabels(period, days)}
          tooltipLabels={days.map(formatLongDay)}
          series={series}
          ariaLabel={`Gasto acumulado de IA na ${kindLabel}: você ${formatUsd(period.mineUsd)}, espaço de trabalho ${formatUsd(period.workspaceUsd)}, limite ${formatUsd(period.limitUsd)}`}
        />
        <details className='text-sm'>
          <summary className='cursor-pointer text-muted-foreground text-xs'>
            Ver dados em tabela
          </summary>
          <div className='mt-2 max-h-64 overflow-auto rounded-md border'>
            <table className='w-full text-xs'>
              <thead className='bg-muted/50 text-muted-foreground'>
                <tr>
                  <th className='px-2 py-1.5 text-left font-medium'>Dia</th>
                  <th className='px-2 py-1.5 text-right font-medium'>Você</th>
                  <th className='px-2 py-1.5 text-right font-medium'>
                    Espaço de trabalho
                  </th>
                </tr>
              </thead>
              <tbody className='tabular-nums'>
                {period.points.map((p) => (
                  <tr key={p.date} className='border-t'>
                    <td className='px-2 py-1'>{formatDayMonth(p.date)}</td>
                    <td className='px-2 py-1 text-right'>
                      {formatUsd(p.mineUsd)}
                    </td>
                    <td className='px-2 py-1 text-right'>
                      {formatUsd(p.workspaceUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

export function TrendCard({ data }: { data: AiUsageOverviewDTO }) {
  const [kind, setKind] = useState<'week' | 'month'>('month')
  const period = kind === 'week' ? data.week : data.month
  const previousLabel = kind === 'week' ? 'semana passada' : 'mês passado'
  const length = Math.max(period.days, period.previous.points.length)
  const days = periodDays(period)
  const labels = Array.from({ length }, (_, i) =>
    kind === 'week' ? (xLabels(period, days)[i] ?? '') : String(i + 1),
  )
  const today = period.points.length - 1
  const projection = Array.from({ length }, (_, i) => {
    if (i < today || i >= period.days) return null
    const step =
      (period.projectedMineUsd - period.mineUsd) /
      Math.max(1, period.days - 1 - today)
    return period.mineUsd + step * (i - today)
  })
  const series: UsageLineSeries[] = [
    {
      id: 'current',
      label: kind === 'week' ? 'Esta semana' : 'Este mês',
      color: VIZ.mine,
      values: pad(period.points, (p) => p.mineUsd, length),
    },
    {
      id: 'projection',
      label: 'Projeção (ritmo atual)',
      color: VIZ.mine,
      dashed: true,
      values: projection,
    },
    {
      id: 'previous',
      label: kind === 'week' ? 'Semana passada' : 'Mês passado',
      color: VIZ.workspace,
      values: pad(period.previous.points, (p) => p.mineUsd, length),
    },
  ]
  const workspaceProjectionShare =
    period.limitUsd > 0 ? period.projectedWorkspaceUsd / period.limitUsd : 0

  return (
    <Card>
      <CardHeader className='gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1.5'>
          <CardTitle>Tendência</CardTitle>
          <CardDescription>
            Seu gasto comparado ao período anterior no mesmo ponto, e a projeção
            linear para o fim do período (média diária até hoje × dias do
            período).
          </CardDescription>
        </div>
        <Tabs
          value={kind}
          onValueChange={(value) =>
            setKind(value === 'week' ? 'week' : 'month')
          }
        >
          <TabsList aria-label='Período da tendência'>
            <TabsTrigger value='week'>Semana</TabsTrigger>
            <TabsTrigger value='month'>Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
          <StatTile
            label='Até agora'
            value={formatUsd(period.mineUsd)}
            detail={`${period.elapsedDays} de ${period.days} dias`}
          />
          <StatTile
            label={`Variação vs ${previousLabel}`}
            value={formatChange(period.mineChangePercent)}
            detail={`${previousLabel} no mesmo ponto: ${formatUsd(period.previous.mineSamePointUsd)}`}
          />
          <StatTile
            label='Projeção para o fim'
            value={formatUsd(period.projectedMineUsd)}
            detail='no ritmo atual'
          />
          <StatTile
            label={
              kind === 'week'
                ? 'Total da semana passada'
                : 'Total do mês passado'
            }
            value={formatUsd(period.previous.mineUsd)}
          />
        </div>
        <ChartLegend items={series} />
        <UsageLineChart
          labels={labels}
          tooltipLabels={labels.map((l, i) =>
            kind === 'week' ? l : `Dia ${i + 1}`,
          )}
          series={series}
          ariaLabel={`Tendência do seu gasto: ${formatUsd(period.mineUsd)} até agora, ${formatChange(period.mineChangePercent)} vs ${previousLabel}, projeção de ${formatUsd(period.projectedMineUsd)}`}
        />
        <p className='text-muted-foreground text-xs'>
          No ritmo atual, o espaço de trabalho fecha{' '}
          {kind === 'week' ? 'a semana' : 'o mês'} em{' '}
          <span className='font-medium text-foreground'>
            {formatUsd(period.projectedWorkspaceUsd)}
          </span>{' '}
          ({formatShare(workspaceProjectionShare)}{' '}
          {kind === 'week' ? 'da parcela semanal' : 'da cota mensal'}) —{' '}
          {formatChange(period.workspaceChangePercent)} vs {previousLabel} no
          mesmo ponto.
        </p>
      </CardContent>
    </Card>
  )
}
