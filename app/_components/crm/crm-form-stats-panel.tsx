'use client'

import {
  Building06Icon,
  Link04Icon,
  Target01Icon,
  Tick02Icon,
  UserGroupIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { format, formatDistanceToNow, startOfDay, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCrmFormSubmissions } from '@/src/hooks/use-crm-form'
import type {
  CrmFormFieldDefinition,
  CrmFormSubmissionDTO,
} from '@/types/crm-form'

const TIMESERIES_DAYS = 14

type DayBucket = { date: Date; label: string; count: number }
type FieldStat = {
  field: CrmFormFieldDefinition
  answered: number
  distribution: { value: string; count: number }[] | null
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

function buildTimeseries(submissions: CrmFormSubmissionDTO[]): DayBucket[] {
  const today = startOfDay(new Date())
  const buckets: DayBucket[] = []
  const indexByKey = new Map<string, number>()
  for (let i = TIMESERIES_DAYS - 1; i >= 0; i--) {
    const date = subDays(today, i)
    const key = format(date, 'yyyy-MM-dd')
    indexByKey.set(key, buckets.length)
    buckets.push({ date, label: format(date, 'd/MM'), count: 0 })
  }
  for (const sub of submissions) {
    const key = format(startOfDay(new Date(sub.createdAt)), 'yyyy-MM-dd')
    const idx = indexByKey.get(key)
    if (idx !== undefined) buckets[idx].count += 1
  }
  return buckets
}

function buildFieldStats(
  fields: CrmFormFieldDefinition[],
  submissions: CrmFormSubmissionDTO[],
): FieldStat[] {
  return fields.map((field) => {
    let answered = 0
    const counts = new Map<string, number>()
    const distributable = field.type === 'select' || field.type === 'checkbox'

    for (const sub of submissions) {
      const text = valueToText(sub.values[field.key])
      if (text === '') continue
      answered += 1
      if (distributable) counts.set(text, (counts.get(text) ?? 0) + 1)
    }

    const distribution = distributable
      ? [...counts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
      : null

    return { field, answered, distribution }
  })
}

export function CrmFormStatsPanel({
  open,
  onOpenChange,
  workspaceId,
  formId,
  formName,
  fields,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  formId: string
  formName: string
  fields: CrmFormFieldDefinition[]
}) {
  const { items: submissions, isLoading } = useCrmFormSubmissions(
    workspaceId,
    formId,
  )

  const stats = useMemo(() => {
    const total = submissions.length
    const persons = submissions.filter((s) => s.createdPersonId).length
    const companies = submissions.filter((s) => s.createdCompanyId).length
    const leads = submissions.filter((s) => s.createdLeadId).length

    const referrers = new Map<string, number>()
    for (const s of submissions) {
      let host = 'Direto'
      if (s.referrer) {
        try {
          host = new URL(s.referrer).hostname
        } catch {
          host = 'Direto'
        }
      }
      referrers.set(host, (referrers.get(host) ?? 0) + 1)
    }
    const topReferrers = [...referrers.entries()]
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const last = submissions[0]?.createdAt ?? null

    return {
      total,
      persons,
      companies,
      leads,
      topReferrers,
      last,
      timeseries: buildTimeseries(submissions),
      fieldStats: buildFieldStats(fields, submissions),
    }
  }, [submissions, fields])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full gap-0 p-0 sm:max-w-md'>
        <SheetHeader className='border-b'>
          <SheetTitle>Respostas</SheetTitle>
          <SheetDescription className='truncate'>
            {formName || 'Formulário sem título'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto'>
          {isLoading ? (
            <div className='flex flex-col gap-3 p-4'>
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-32 w-full' />
              <Skeleton className='h-40 w-full' />
            </div>
          ) : stats.total === 0 ? (
            <EmptyState />
          ) : (
            <div className='flex flex-col gap-6 p-4'>
              <SummaryCards stats={stats} />
              <Timeseries buckets={stats.timeseries} />
              {stats.topReferrers.length > 0 ? (
                <ReferrerBreakdown
                  items={stats.topReferrers}
                  total={stats.total}
                />
              ) : null}
              <FieldBreakdown
                fieldStats={stats.fieldStats}
                total={stats.total}
              />
              <RecentSubmissions
                submissions={submissions.slice(0, 25)}
                fields={fields}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EmptyState() {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-2 p-10 text-center'>
      <p className='font-medium text-sm'>Nenhuma resposta ainda</p>
      <p className='text-muted-foreground text-xs'>
        Publique o formulário e compartilhe a URL pública para começar a coletar
        respostas.
      </p>
    </div>
  )
}

function SummaryCards({
  stats,
}: {
  stats: {
    total: number
    persons: number
    companies: number
    leads: number
    last: string | null
  }
}) {
  return (
    <section className='flex flex-col gap-3'>
      <div className='grid grid-cols-2 gap-2'>
        <StatCard
          icon={Tick02Icon}
          label='Total de respostas'
          value={stats.total}
        />
        {stats.persons > 0 ? (
          <StatCard
            icon={UserGroupIcon}
            label='Pessoas criadas'
            value={stats.persons}
          />
        ) : null}
        {stats.companies > 0 ? (
          <StatCard
            icon={Building06Icon}
            label='Empresas criadas'
            value={stats.companies}
          />
        ) : null}
        {stats.leads > 0 ? (
          <StatCard
            icon={Target01Icon}
            label='Leads criados'
            value={stats.leads}
          />
        ) : null}
      </div>
      {stats.last ? (
        <p className='text-muted-foreground text-xs'>
          Última resposta{' '}
          {formatDistanceToNow(new Date(stats.last), {
            addSuffix: true,
            locale: ptBR,
          })}
          .
        </p>
      ) : null}
    </section>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: typeof Tick02Icon
  label: string
  value: number
}) {
  return (
    <div className='flex flex-col gap-1 rounded-lg border p-3'>
      <div className='flex items-center gap-1.5 text-muted-foreground'>
        <SteelIcon icon={icon} strokeWidth={2} className='size-3.5' />
        <span className='text-xs'>{label}</span>
      </div>
      <span className='font-semibold text-xl tabular-nums'>{value}</span>
    </div>
  )
}

function Timeseries({ buckets }: { buckets: DayBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const total = buckets.reduce((acc, b) => acc + b.count, 0)
  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-baseline justify-between'>
        <h3 className='font-medium text-sm'>Últimos {TIMESERIES_DAYS} dias</h3>
        <span className='text-muted-foreground text-xs'>
          {total} {total === 1 ? 'resposta' : 'respostas'}
        </span>
      </div>
      <div className='flex h-28 items-end gap-1'>
        {buckets.map((b) => (
          <div
            key={b.label}
            className='group flex flex-1 flex-col items-center gap-1'
            title={`${b.label}: ${b.count}`}
          >
            <div className='flex w-full flex-1 items-end'>
              <div
                className={cn(
                  'w-full rounded-sm transition-colors',
                  b.count > 0 ? 'bg-primary' : 'bg-muted',
                )}
                style={{
                  height: b.count > 0 ? `${(b.count / max) * 100}%` : '2px',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className='flex justify-between text-[10px] text-muted-foreground'>
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </section>
  )
}

function ReferrerBreakdown({
  items,
  total,
}: {
  items: { host: string; count: number }[]
  total: number
}) {
  return (
    <section className='flex flex-col gap-3'>
      <h3 className='flex items-center gap-1.5 font-medium text-sm'>
        <SteelIcon icon={Link04Icon} strokeWidth={2} className='size-3.5' />
        Origens
      </h3>
      <div className='flex flex-col gap-2'>
        {items.map((item) => (
          <BarRow
            key={item.host}
            label={item.host}
            count={item.count}
            total={total}
          />
        ))}
      </div>
    </section>
  )
}

function FieldBreakdown({
  fieldStats,
  total,
}: {
  fieldStats: FieldStat[]
  total: number
}) {
  if (fieldStats.length === 0) return null
  return (
    <section className='flex flex-col gap-4'>
      <h3 className='font-medium text-sm'>Campos</h3>
      {fieldStats.map(({ field, answered, distribution }) => (
        <div key={field.key} className='flex flex-col gap-2'>
          <div className='flex items-baseline justify-between gap-2'>
            <span className='truncate font-medium text-xs'>{field.label}</span>
            <span className='shrink-0 text-muted-foreground text-[10px]'>
              {answered}/{total} preenchido{answered === 1 ? '' : 's'}
            </span>
          </div>
          {distribution && distribution.length > 0 ? (
            <div className='flex flex-col gap-1.5'>
              {distribution.slice(0, 8).map((d) => (
                <BarRow
                  key={d.value}
                  label={d.value}
                  count={d.count}
                  total={total}
                />
              ))}
            </div>
          ) : (
            <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full rounded-full bg-primary'
                style={{
                  width: `${total > 0 ? (answered / total) * 100 : 0}%`,
                }}
              />
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function BarRow({
  label,
  count,
  total,
}: {
  label: string
  count: number
  total: number
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-baseline justify-between gap-2'>
        <span className='truncate text-muted-foreground text-xs'>{label}</span>
        <span className='shrink-0 text-[10px] text-muted-foreground tabular-nums'>
          {count} · {pct}%
        </span>
      </div>
      <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className='h-full rounded-full bg-primary'
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function RecentSubmissions({
  submissions,
  fields,
}: {
  submissions: CrmFormSubmissionDTO[]
  fields: CrmFormFieldDefinition[]
}) {
  return (
    <section className='flex flex-col gap-3'>
      <h3 className='font-medium text-sm'>Respostas recentes</h3>
      <div className='flex flex-col gap-2'>
        {submissions.map((sub) => (
          <SubmissionRow key={sub.id} submission={sub} fields={fields} />
        ))}
      </div>
    </section>
  )
}

function SubmissionRow({
  submission,
  fields,
}: {
  submission: CrmFormSubmissionDTO
  fields: CrmFormFieldDefinition[]
}) {
  const [open, setOpen] = useState(false)
  const primary =
    fields
      .map((f) => valueToText(submission.values[f.key]))
      .find((v) => v !== '') ?? 'Resposta'

  return (
    <div className='rounded-lg border text-sm'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='flex w-full items-center justify-between gap-2 px-3 py-2 text-left'
      >
        <span className='truncate font-medium'>{primary}</span>
        <span className='shrink-0 text-[10px] text-muted-foreground'>
          {format(new Date(submission.createdAt), 'd/MM HH:mm', {
            locale: ptBR,
          })}
        </span>
      </button>
      {open ? (
        <dl className='flex flex-col gap-1.5 border-t px-3 py-2'>
          {fields.map((field) => {
            const text = valueToText(submission.values[field.key])
            return (
              <div
                key={field.key}
                className='grid grid-cols-[40%_60%] gap-2 text-xs'
              >
                <dt className='truncate text-muted-foreground'>
                  {field.label}
                </dt>
                <dd className='break-words'>
                  {text || <span className='text-muted-foreground/60'>—</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      ) : null}
    </div>
  )
}
