'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WorklogPeriodFilter } from '@/src/hooks/use-worklogs'
import type { WorklogPeriodPreset } from '@/src/lib/productivity/period'
import type { WorklogPersonDTO } from '@/types/worklog'

export const PERIOD_LABELS: Record<WorklogPeriodPreset, string> = {
  last_7_days: 'Últimos 7 dias',
  last_30_days: 'Últimos 30 dias',
  this_month: 'Este mês',
  last_month: 'Mês passado',
  custom: 'Personalizado',
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A custom period is only queried once both days are filled in order. */
export function isPeriodReady(filter: WorklogPeriodFilter): boolean {
  if (filter.period !== 'custom') return true
  return (
    DAY.test(filter.from ?? '') &&
    DAY.test(filter.to ?? '') &&
    (filter.from as string) <= (filter.to as string)
  )
}

export function PeriodFilter({
  value,
  onChange,
  idPrefix,
}: {
  value: WorklogPeriodFilter
  onChange: (next: WorklogPeriodFilter) => void
  idPrefix: string
}) {
  return (
    <>
      <Select
        value={value.period}
        onValueChange={(period) => {
          if (typeof period === 'string' && period in PERIOD_LABELS) {
            onChange({ ...value, period: period as WorklogPeriodPreset })
          }
        }}
      >
        <SelectTrigger aria-label='Período' className='w-full sm:w-44'>
          <SelectValue>
            {(period: WorklogPeriodPreset) => PERIOD_LABELS[period]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {(Object.keys(PERIOD_LABELS) as WorklogPeriodPreset[]).map(
              (key) => (
                <SelectItem key={key} value={key}>
                  {PERIOD_LABELS[key]}
                </SelectItem>
              ),
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
      {value.period === 'custom' ? (
        <div className='flex w-full flex-wrap items-end gap-2 sm:w-auto'>
          <div className='min-w-0 flex-1 space-y-1 sm:flex-none'>
            <Label htmlFor={`${idPrefix}-from`} className='text-xs'>
              De
            </Label>
            <Input
              id={`${idPrefix}-from`}
              type='date'
              value={value.from ?? ''}
              max={value.to || undefined}
              onChange={(event) =>
                onChange({ ...value, from: event.target.value })
              }
              className='sm:w-40'
            />
          </div>
          <div className='min-w-0 flex-1 space-y-1 sm:flex-none'>
            <Label htmlFor={`${idPrefix}-to`} className='text-xs'>
              Até
            </Label>
            <Input
              id={`${idPrefix}-to`}
              type='date'
              value={value.to ?? ''}
              min={value.from || undefined}
              onChange={(event) =>
                onChange({ ...value, to: event.target.value })
              }
              className='sm:w-40'
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

const EVERYONE = '__all__'

export function PersonFilter({
  people,
  value,
  onChange,
  allLabel,
}: {
  people: WorklogPersonDTO[]
  value: string | undefined
  onChange: (userId: string | undefined) => void
  allLabel: string
}) {
  const names = new Map(people.map((p) => [p.id, p.name]))
  return (
    <Select
      value={value ?? EVERYONE}
      onValueChange={(next) => {
        if (typeof next !== 'string') return
        onChange(next === EVERYONE ? undefined : next)
      }}
    >
      <SelectTrigger aria-label='Pessoa' className='w-full sm:w-52'>
        <SelectValue>
          {(id: string) => (id === EVERYONE ? allLabel : (names.get(id) ?? id))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectItem value={EVERYONE}>{allLabel}</SelectItem>
          {people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
