'use client'

import { Clock01Icon, RepeatIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSdRecurringTickets } from '@/src/hooks/use-sd-recurring-tickets'
import {
  describeSdRecurrence,
  type SdRecurrenceSchedule,
} from '@/src/lib/servicedesk/recurrence'
import type {
  SdRecurringRunStatusDTO,
  SdRecurringTicketDTO,
} from '@/types/sd-recurring-ticket'

/**
 * Peças compartilhadas dos chamados recorrentes: a aba "Recorrentes" das
 * configurações e o bloco de rotinas da tela do item de configuração.
 */

export const SD_RUN_STATUS_LABEL: Record<SdRecurringRunStatusDTO, string> = {
  CREATED: 'Abriu',
  SKIPPED: 'Pulou',
  FAILED: 'Falhou',
}

export const SD_RUN_STATUS_TONE: Record<SdRecurringRunStatusDTO, string> = {
  CREATED:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  SKIPPED:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  FAILED: 'border-destructive/30 bg-destructive/10 text-destructive',
}

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/** Data/hora de uma ocorrência; com `timezone`, no fuso da regra. */
export function formatSdOccurrence(iso: string, timezone?: string): string {
  const formatter = timezone
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: timezone,
      })
    : dateTime
  return formatter.format(new Date(iso))
}

/** A agenda da rotina no formato da lib de recorrência. */
export function sdScheduleOf(rule: SdRecurringTicketDTO): SdRecurrenceSchedule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    byWeekday: rule.byWeekday,
    byMonthday: rule.byMonthday,
    atTime: rule.atTime,
    timezone: rule.timezone,
    startsAt: new Date(rule.startsAt),
    endsAt: rule.endsAt ? new Date(rule.endsAt) : null,
    leadTimeMinutes: rule.leadTimeMinutes,
  }
}

/**
 * Rotinas que incidem sobre um item de configuração (aba do CI). Só leitura:
 * a configuração fica em Configurações > Recorrentes.
 */
export function SdConfigItemRoutines({
  workspaceId,
  configItemId,
  slug,
}: {
  workspaceId: string
  configItemId: string
  slug: string
}) {
  const { data, isLoading, error } = useSdRecurringTickets(workspaceId, {
    configItemId,
    includeInactive: true,
  })
  const rules = data ?? []

  if (isLoading) {
    return (
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
      </div>
    )
  }

  if (error) {
    return <p className='text-destructive text-sm'>{error.message}</p>
  }

  if (rules.length === 0) {
    return (
      <p className='rounded-lg border border-border border-dashed px-4 py-6 text-center text-muted-foreground text-sm'>
        Nenhuma rotina preventiva incide sobre este item. Crie uma em
        Configurações {'>'} Recorrentes.
      </p>
    )
  }

  return (
    <ul className='flex flex-col divide-y divide-border'>
      {rules.map((rule) => (
        <li key={rule.id} className='flex items-start gap-3 py-2.5'>
          <SteelIcon
            icon={RepeatIcon}
            strokeWidth={2}
            className={cn(
              'mt-0.5 size-4 shrink-0',
              rule.active ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <div className='min-w-0 flex-1'>
            <div className='truncate font-medium text-sm'>{rule.name}</div>
            <div className='text-muted-foreground text-xs'>
              {describeSdRecurrence(sdScheduleOf(rule))}
            </div>
            <div className='mt-0.5 flex items-center gap-1.5 text-xs'>
              <SteelIcon
                icon={Clock01Icon}
                strokeWidth={2}
                className='size-3.5 text-muted-foreground'
              />
              {rule.active && rule.nextRunAt ? (
                <span className='tabular-nums'>
                  Próxima: {formatSdOccurrence(rule.nextRunAt, rule.timezone)}
                </span>
              ) : (
                <span className='text-muted-foreground'>
                  {rule.active ? 'Vigência encerrada' : 'Pausada'}
                </span>
              )}
            </div>
          </div>
          {slug ? (
            <Link
              href={`/${slug}/servicedesk/settings?tab=recurring`}
              className='shrink-0 text-primary text-xs hover:underline'
            >
              Configurar
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
