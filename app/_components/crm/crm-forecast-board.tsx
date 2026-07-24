'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { setCrmQuota, useCrmForecast } from '@/src/hooks/use-crm-forecast'
import type { ForecastRow } from '@/src/schemas/crm-forecast.schema'

const moneyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

type Period = 'MONTH' | 'QUARTER'

function attainmentColor(pct: number | null): string {
  if (pct === null) return 'bg-muted-foreground/30'
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function CrmForecastBoard({ workspaceId }: { workspaceId: string }) {
  const [period, setPeriod] = React.useState<Period>('MONTH')
  const { data, isLoading, refetch } = useCrmForecast(workspaceId, period)

  const rows = data?.rows ?? []

  return (
    <div className='mx-auto w-full max-w-5xl'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <p className='text-muted-foreground text-sm'>
          Previsão = ganho no período + pipeline aberto ponderado pela
          probabilidade da etapa.
        </p>
        <Tabs value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value='MONTH'>Mês</TabsTrigger>
            <TabsTrigger value='QUARTER'>Trimestre</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
        </div>
      ) : rows.length === 0 ? (
        <p className='py-12 text-center text-muted-foreground text-sm'>
          Sem dados de previsão. Crie oportunidades com data de fechamento e
          defina metas para acompanhar o atingimento.
        </p>
      ) : (
        <div className='overflow-hidden rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/40 text-muted-foreground text-xs'>
              <tr>
                <th className='px-3 py-2 text-left font-medium'>Período</th>
                <th className='px-3 py-2 text-left font-medium'>Responsável</th>
                <th className='px-3 py-2 text-right font-medium'>Ganho</th>
                <th className='px-3 py-2 text-right font-medium'>Ponderado</th>
                <th className='px-3 py-2 text-right font-medium'>Previsão</th>
                <th className='px-3 py-2 text-right font-medium'>Meta</th>
                <th className='px-3 py-2 text-left font-medium'>Atingimento</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ForecastRowItem
                  key={`${row.ownerId ?? 'none'}:${row.periodKey}`}
                  workspaceId={workspaceId}
                  period={period}
                  row={row}
                  onSaved={refetch}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ForecastRowItem({
  workspaceId,
  period,
  row,
  onSaved,
}: {
  workspaceId: string
  period: Period
  row: ForecastRow
  onSaved: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(row.quotaAmount || ''))
  const [saving, setSaving] = React.useState(false)

  async function save() {
    setEditing(false)
    const target = Number(draft) || 0
    if (target === row.quotaAmount) return
    if (!row.ownerId) {
      notify.error('Defina um responsável na oportunidade para criar a meta.')
      return
    }
    setSaving(true)
    const result = await setCrmQuota(workspaceId, {
      ownerId: row.ownerId,
      period,
      periodKey: row.periodKey,
      targetAmount: target,
    })
    setSaving(false)
    if (result.ok) {
      notify.success('Meta atualizada.')
      onSaved()
    } else {
      notify.error(result.message ?? 'Não foi possível salvar a meta.')
    }
  }

  const pct = row.attainmentPct

  return (
    <tr className='border-t'>
      <td className='px-3 py-2 font-medium tabular-nums'>{row.periodKey}</td>
      <td className='px-3 py-2'>{row.ownerName}</td>
      <td className='px-3 py-2 text-right text-emerald-600 tabular-nums'>
        {moneyFmt.format(row.wonAmount)}
      </td>
      <td className='px-3 py-2 text-right text-muted-foreground tabular-nums'>
        {moneyFmt.format(row.weightedOpenAmount)}
      </td>
      <td className='px-3 py-2 text-right font-semibold tabular-nums'>
        {moneyFmt.format(row.forecastAmount)}
      </td>
      <td className='px-3 py-2 text-right'>
        {editing ? (
          <Input
            autoFocus
            type='number'
            min={0}
            value={draft}
            className='h-7 w-28 text-right'
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <button
            type='button'
            onClick={() => {
              setDraft(String(row.quotaAmount || ''))
              setEditing(true)
            }}
            disabled={saving}
            className='rounded px-1.5 py-0.5 tabular-nums hover:bg-muted/50'
          >
            {row.quotaAmount > 0 ? (
              moneyFmt.format(row.quotaAmount)
            ) : (
              <span className='text-muted-foreground/60'>definir</span>
            )}
          </button>
        )}
      </td>
      <td className='px-3 py-2'>
        <div className='flex items-center gap-2'>
          <div className='h-2 w-24 overflow-hidden rounded-full bg-muted'>
            <div
              className={cn('h-full rounded-full', attainmentColor(pct))}
              style={{ width: `${Math.min(100, pct ?? 0)}%` }}
            />
          </div>
          <span className='w-10 text-muted-foreground text-xs tabular-nums'>
            {pct === null ? '—' : `${pct}%`}
          </span>
        </div>
      </td>
    </tr>
  )
}
