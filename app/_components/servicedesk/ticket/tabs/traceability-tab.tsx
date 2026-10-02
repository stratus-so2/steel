'use client'

import type { IconSvgElement } from '@hugeicons/react'
import {
  Activity01Icon,
  AiMagicIcon,
  Alert02Icon,
  ArrowRight01Icon,
  ArrowUpDoubleIcon,
  Edit02Icon,
  PlusSignIcon,
  Route01Icon,
  Timer02Icon,
  UserAdd01Icon,
  UserSwitchIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSdTicketEvents } from '@/src/hooks/use-sd-tickets'
import type { SdTicketEventDTO } from '@/types/sd-ticket'
import { SdUserAvatar, useSdNow } from '../sd-ticket-badges'
import {
  SD_EVENT_KIND_LABEL,
  type SdEventKind,
  sdDescribeEvent,
  sdEventActorName,
  sdGroupEventsByDay,
} from '../sd-ticket-events'
import { SD_TONE, sdFormatDateTime, sdRelativeTime } from '../sd-ticket-meta'
import type { SdTicketTabProps } from './types'

const KIND_STYLE: Record<SdEventKind, { icon: IconSvgElement; tone: string }> =
  {
    ticket: { icon: PlusSignIcon, tone: SD_TONE.sky },
    field: { icon: Edit02Icon, tone: SD_TONE.slate },
    phase: { icon: Route01Icon, tone: SD_TONE.indigo },
    assignment: { icon: UserSwitchIcon, tone: SD_TONE.violet },
    escalation: { icon: ArrowUpDoubleIcon, tone: SD_TONE.orange },
    sla: { icon: Timer02Icon, tone: SD_TONE.red },
    people: { icon: UserAdd01Icon, tone: SD_TONE.teal },
    activity: { icon: Activity01Icon, tone: SD_TONE.emerald },
    system: { icon: AiMagicIcon, tone: SD_TONE.amber },
  }

/** "De → para" de uma alteração: o valor antigo riscado, o novo em verde. */
const DIFF_TONE = {
  from: cn(SD_TONE.red, 'line-through decoration-red-500/40'),
  to: cn(SD_TONE.emerald, 'font-medium'),
  empty: 'bg-muted text-muted-foreground italic',
} as const

const FILTERS: (SdEventKind | 'all')[] = [
  'all',
  'phase',
  'field',
  'assignment',
  'escalation',
  'sla',
  'people',
  'activity',
  'system',
]

function EventItem({
  event,
  now,
  last,
}: {
  event: SdTicketEventDTO
  now: Date
  last: boolean
}) {
  const description = sdDescribeEvent(event)
  const style = KIND_STYLE[description.kind]
  return (
    <li className='relative flex gap-3 pb-5 last:pb-0'>
      {last ? null : (
        <span
          aria-hidden
          className='absolute top-8 bottom-0 left-4 w-px bg-border'
        />
      )}
      <span
        className={cn(
          'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background',
          style.tone,
        )}
      >
        <SteelIcon icon={style.icon} strokeWidth={2} className='size-4' />
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-1 pt-1'>
        <div className='flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm'>
          {event.actor ? (
            <SdUserAvatar user={event.actor} className='size-5' />
          ) : null}
          <span className='font-medium'>{sdEventActorName(event)}</span>
          <span className='text-muted-foreground'>{description.title}</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <time
                  dateTime={event.createdAt}
                  className='ml-auto text-muted-foreground text-xs tabular-nums'
                >
                  {sdRelativeTime(event.createdAt, now)}
                </time>
              }
            />
            <TooltipContent>{sdFormatDateTime(event.createdAt)}</TooltipContent>
          </Tooltip>
        </div>
        {description.from || description.to ? (
          <div className='flex flex-wrap items-center gap-1.5 text-xs'>
            {description.from ? (
              <span
                className={cn(
                  'max-w-72 truncate rounded-md px-1.5 py-0.5',
                  DIFF_TONE.from,
                )}
              >
                {description.from}
              </span>
            ) : description.kind === 'field' ||
              description.kind === 'assignment' ? (
              <span className={cn('rounded-md px-1.5 py-0.5', DIFF_TONE.empty)}>
                vazio
              </span>
            ) : null}
            {description.from || description.kind === 'field' ? (
              <SteelIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className='size-3 text-muted-foreground'
              />
            ) : null}
            {description.to ? (
              <span
                className={cn(
                  'max-w-72 truncate rounded-md px-1.5 py-0.5',
                  DIFF_TONE.to,
                )}
              >
                {description.to}
              </span>
            ) : (
              <span className={cn('rounded-md px-1.5 py-0.5', DIFF_TONE.empty)}>
                vazio
              </span>
            )}
          </div>
        ) : null}
        {description.detail ? (
          <p className='rounded-md border-l-2 bg-muted/40 px-2 py-1 text-muted-foreground text-xs'>
            {description.detail}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Rastreabilidade: linha do tempo vertical dos eventos do chamado, por
 * dia, com ícone por tipo, autor, horário relativo (absoluto no tooltip),
 * "de → para" e filtro por tipo.
 */
export function SdTicketTraceabilityTab({
  workspaceId,
  ticket,
}: SdTicketTabProps) {
  const now = useSdNow(60_000)
  const [kind, setKind] = useState<SdEventKind | 'all'>('all')
  const query = useSdTicketEvents(workspaceId, ticket.id)
  const all = query.data?.pages.flatMap((p) => p.items) ?? []
  const events =
    kind === 'all' ? all : all.filter((e) => sdDescribeEvent(e).kind === kind)
  const groups = sdGroupEventsByDay(events, now)

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div
        role='toolbar'
        aria-label='Filtrar eventos'
        className='flex flex-wrap gap-1'
      >
        {FILTERS.map((k) => (
          <button
            key={k}
            type='button'
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              'h-7 rounded-full border px-2.5 text-xs transition-colors',
              kind === k
                ? 'border-primary bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {k === 'all' ? 'Tudo' : SD_EVENT_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className='flex flex-col gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`sk-${i}`} className='flex gap-3'>
              <Skeleton className='size-8 rounded-full' />
              <Skeleton className='h-10 flex-1' />
            </div>
          ))}
        </div>
      ) : query.error ? (
        <p className='flex items-center gap-2 text-destructive text-sm'>
          <SteelIcon icon={Alert02Icon} strokeWidth={2} className='size-4' />
          {query.error.message}
        </p>
      ) : groups.length === 0 ? (
        <p className='py-10 text-center text-muted-foreground text-sm'>
          Nenhum evento
          {kind === 'all'
            ? ''
            : ` de ${SD_EVENT_KIND_LABEL[kind].toLowerCase()}`}
          .
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.day} className='flex flex-col gap-3'>
            <h4 className='sticky top-0 z-20 w-fit rounded-full border bg-background px-2.5 py-0.5 font-medium text-muted-foreground text-xs capitalize'>
              {group.day}
            </h4>
            <ol className='flex flex-col'>
              {group.events.map((event, i) => (
                <EventItem
                  key={event.id}
                  event={event}
                  now={now}
                  last={i === group.events.length - 1}
                />
              ))}
            </ol>
          </section>
        ))
      )}

      {query.hasNextPage ? (
        <Button
          variant='outline'
          size='sm'
          className='self-center'
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais antigos'}
        </Button>
      ) : null}
    </div>
  )
}
