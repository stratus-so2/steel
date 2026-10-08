'use client'

import { Download01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { StatTile } from '@/app/_components/steel-ai-usage/usage-charts'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useWorklogs,
  type WorklogFilter,
  worklogExportUrl,
} from '@/src/hooks/use-worklogs'
import type { WorklogEntryDTO } from '@/types/worklog'
import { isPeriodReady, PeriodFilter, PersonFilter } from './worklog-filters'
import {
  formatDateTime,
  formatDayKey,
  formatHours,
  formatInteger,
  formatMinutes,
  formatMoney,
  formatPercent,
} from './worklog-format'

const ANY = '__any__'

const BILLABLE: Record<string, string> = {
  [ANY]: 'Faturável ou não',
  true: 'Só faturáveis',
  false: 'Só não faturáveis',
}

const SOURCE: Record<string, string> = {
  [ANY]: 'Todas as origens',
  TIMER: 'Cronômetro',
  MANUAL: 'Manual',
}

function OptionSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Record<string, string>
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => {
        if (typeof next !== 'string') return
        onChange(next === ANY ? undefined : next)
      }}
    >
      <SelectTrigger aria-label={label} className='w-full sm:w-44'>
        <SelectValue>{(key: string) => options[key]}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function EntryRow({
  entry,
  timezone,
}: {
  entry: WorklogEntryDTO
  timezone: string
}) {
  return (
    <li className='flex flex-wrap items-start gap-x-4 gap-y-1 py-3'>
      <div className='min-w-0 flex-1 space-y-1'>
        <p className='break-words text-sm'>
          <span className='font-medium'>{entry.ticket.code}</span>{' '}
          <span className='text-muted-foreground'>{entry.ticket.title}</span>
        </p>
        <p className='break-words text-muted-foreground text-xs'>
          {entry.user.name} · {formatDateTime(entry.startedAt, timezone)}
          {entry.description ? ` · ${entry.description}` : ''}
        </p>
        <div className='flex flex-wrap gap-1.5'>
          <Badge variant={entry.billable ? 'secondary' : 'outline'}>
            {entry.billable ? 'Faturável' : 'Não faturável'}
          </Badge>
          <Badge variant='outline'>
            {entry.source === 'TIMER' ? 'Cronômetro' : 'Manual'}
          </Badge>
        </div>
      </div>
      <div className='text-right'>
        <p className='font-medium text-sm tabular-nums'>
          {formatMinutes(entry.minutes)}
        </p>
        {entry.amount !== null ? (
          <p className='text-muted-foreground text-xs tabular-nums'>
            {formatMoney(entry.amount)}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/** Tab "Apontamentos": filtered ServiceDesk time entries + CSV. */
export function WorklogEntries({ workspaceId }: { workspaceId: string }) {
  const [filter, setFilter] = useState<WorklogFilter>({
    period: 'last_30_days',
    page: 1,
  })
  const [ticketDraft, setTicketDraft] = useState('')
  const ready = isPeriodReady(filter)
  const list = useWorklogs(workspaceId, filter, ready)
  const update = (patch: Partial<WorklogFilter>) =>
    setFilter((current) => ({ ...current, ...patch, page: 1 }))

  const data = list.data
  const totals = data?.totals
  const first = data ? (data.page - 1) * data.pageSize + 1 : 0
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0

  if (data && !data.serviceDeskEnabled) {
    return (
      <p className='rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm'>
        O ServiceDesk não está habilitado neste workspace, então não há
        apontamentos de horas para mostrar.
      </p>
    )
  }

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-end gap-2'>
        <PeriodFilter
          value={filter}
          onChange={(next) => update(next)}
          idPrefix='worklog'
        />
        {data?.people ? (
          <PersonFilter
            people={data.people}
            value={filter.userId}
            onChange={(userId) => update({ userId })}
            allLabel='Todas as pessoas'
          />
        ) : null}
        <form
          className='w-full sm:w-44'
          onSubmit={(event) => {
            event.preventDefault()
            update({ ticket: ticketDraft.trim() || undefined })
          }}
        >
          <Input
            aria-label='Chamado'
            placeholder='Chamado (INC-000123)'
            value={ticketDraft}
            onChange={(event) => setTicketDraft(event.target.value)}
            onBlur={() => update({ ticket: ticketDraft.trim() || undefined })}
          />
        </form>
        <OptionSelect
          label='Faturável'
          options={BILLABLE}
          value={filter.billable}
          onChange={(billable) =>
            update({ billable: billable as WorklogFilter['billable'] })
          }
        />
        <OptionSelect
          label='Origem'
          options={SOURCE}
          value={filter.source}
          onChange={(source) =>
            update({ source: source as WorklogFilter['source'] })
          }
        />
        <Button
          variant='outline'
          className='w-full sm:ml-auto sm:w-auto'
          nativeButton={false}
          render={<a href={worklogExportUrl(workspaceId, filter)} download />}
          aria-disabled={!ready}
        >
          <SteelIcon icon={Download01Icon} size={14} />
          Baixar CSV
        </Button>
      </div>

      {data ? (
        <p className='text-muted-foreground text-xs'>
          {formatDayKey(data.period.from)} a {formatDayKey(data.period.to)} ·
          horários em {data.period.timezone}
        </p>
      ) : null}

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatTile
          label='Horas registradas'
          value={totals ? formatHours(totals.minutes) : '—'}
          detail={
            totals ? `${formatInteger(totals.entries)} apontamentos` : undefined
          }
        />
        <StatTile
          label='Faturáveis'
          value={totals ? formatHours(totals.billableMinutes) : '—'}
          detail={
            totals && totals.minutes > 0
              ? `${formatPercent(totals.billableMinutes / totals.minutes)} do total`
              : undefined
          }
        />
        <StatTile
          label='Pelo cronômetro'
          value={totals ? formatHours(totals.timerMinutes) : '—'}
          detail={
            totals ? `${formatHours(totals.manualMinutes)} manuais` : undefined
          }
        />
        <StatTile
          label='Valor apurado'
          value={totals ? formatMoney(totals.amount) : '—'}
        />
      </div>

      {list.isError ? (
        <p className='text-destructive text-sm'>{list.error.message}</p>
      ) : !data ? (
        <div className='space-y-2' data-testid='worklog-loading'>
          <Skeleton className='h-14 w-full' />
          <Skeleton className='h-14 w-full' />
        </div>
      ) : data.items.length === 0 ? (
        <p className='rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm'>
          Nenhum apontamento com esses filtros.
        </p>
      ) : (
        <>
          <ul className='divide-y rounded-xl border px-4'>
            {data.items.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                timezone={data.period.timezone}
              />
            ))}
          </ul>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-muted-foreground text-xs'>
              {formatInteger(first)}–{formatInteger(last)} de{' '}
              {formatInteger(data.total)}
            </p>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={data.page <= 1}
                onClick={() =>
                  setFilter((current) => ({
                    ...current,
                    page: (current.page ?? 1) - 1,
                  }))
                }
              >
                Anterior
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={last >= data.total}
                onClick={() =>
                  setFilter((current) => ({
                    ...current,
                    page: (current.page ?? 1) + 1,
                  }))
                }
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
