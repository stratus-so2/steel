'use client'

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  PauseIcon,
  Timer02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type {
  SdLevelRefDTO,
  SdPhaseSummaryDTO,
  SdSlaTimerDTO,
  SdTicketTypeDTO,
  SdUserSummaryDTO,
} from '@/types/sd-ticket'
import {
  SD_PHASE_CATEGORY_COLOR,
  SD_SLA_STATE_LABEL,
  SD_SLA_STATE_TONE,
  SD_TICKET_TYPE_LABEL,
  SD_TICKET_TYPE_TONE,
  type SdLiveSla,
  sdFormatDateTime,
  sdInitials,
  sdLiveSla,
  sdSlaShortText,
} from './sd-ticket-meta'

/** Relógio que atualiza a cada `intervalMs` (contagens regressivas). */
export function useSdNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export function SdTypeBadge({
  type,
  className,
}: {
  type: SdTicketTypeDTO
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border px-1.5 font-medium text-[11px]',
        SD_TICKET_TYPE_TONE[type],
        className,
      )}
    >
      {SD_TICKET_TYPE_LABEL[type]}
    </span>
  )
}

/** Prioridade, severidade, impacto ou urgência (bolinha com a cor). */
export function SdLevelBadge({
  level,
  prefix,
  className,
}: {
  level: SdLevelRefDTO | null
  prefix?: string
  className?: string
}) {
  if (!level) return null
  const color = level.color ?? '#94a3b8'
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-md border px-1.5 font-medium text-[11px]',
        className,
      )}
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}1a`,
      }}
      title={prefix ? `${prefix}: ${level.name}` : level.name}
    >
      <span
        className='size-1.5 shrink-0 rounded-full'
        style={{ backgroundColor: color }}
      />
      {prefix ? <span className='text-muted-foreground'>{prefix}</span> : null}
      <span className='truncate'>{level.name}</span>
    </span>
  )
}

export function SdPhaseBadge({
  phase,
  className,
}: {
  phase: Pick<SdPhaseSummaryDTO, 'name' | 'color' | 'category'>
  className?: string
}) {
  const color = phase.color ?? SD_PHASE_CATEGORY_COLOR[phase.category]
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 font-medium text-[11px]',
        className,
      )}
      style={{ borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      <span
        className='size-1.5 shrink-0 rounded-full'
        style={{ backgroundColor: color }}
      />
      <span className='truncate'>{phase.name}</span>
    </span>
  )
}

const SLA_ICON = {
  ok: Clock01Icon,
  at_risk: Timer02Icon,
  breached: Alert02Icon,
  met: CheckmarkCircle02Icon,
  paused: PauseIcon,
  none: Clock01Icon,
} as const

/** Chip do SLA com contagem regressiva (ok / em risco / violado / pausado). */
export function SdSlaChip({
  live,
  label,
  className,
  compact,
}: {
  live: SdLiveSla
  /** Ex.: "Resolução" (vai no tooltip). */
  label?: string
  className?: string
  compact?: boolean
}) {
  if (live.state === 'none') return null
  const text = sdSlaShortText(live)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-sla-state={live.state}
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded-md border px-1.5 font-medium text-[11px] tabular-nums',
              SD_SLA_STATE_TONE[live.state],
              className,
            )}
          >
            <SteelIcon
              icon={SLA_ICON[live.state]}
              strokeWidth={2}
              className='size-3'
            />
            {compact ? text : `${SD_SLA_STATE_LABEL[live.state]} · ${text}`}
          </span>
        }
      />
      <TooltipContent>
        {label ? `${label}: ` : ''}
        {SD_SLA_STATE_LABEL[live.state]}
        {live.dueAt ? ` — prazo ${sdFormatDateTime(live.dueAt)}` : ''}
      </TooltipContent>
    </Tooltip>
  )
}

/** Widget de SLA do cabeçalho do chamado (barra de consumo + prazo). */
export function SdSlaWidget({
  label,
  timer,
  now,
  doneAt,
}: {
  label: string
  timer: SdSlaTimerDTO
  now: Date
  /** Quando foi cumprido (1ª resposta / resolução). */
  doneAt?: string | null
}) {
  const live = sdLiveSla(timer, now)
  const percent = Math.min(100, Math.max(0, live.percentUsed ?? 0))
  const bar =
    live.state === 'breached'
      ? 'bg-red-500'
      : live.state === 'at_risk'
        ? 'bg-amber-500'
        : live.state === 'met'
          ? 'bg-muted-foreground/50'
          : live.state === 'paused'
            ? 'bg-slate-400'
            : 'bg-emerald-500'
  return (
    <div className='flex min-w-44 flex-col gap-1 rounded-lg border bg-card/60 px-2.5 py-1.5'>
      <div className='flex items-center justify-between gap-2'>
        <span className='font-medium text-[11px] text-muted-foreground uppercase tracking-wide'>
          {label}
        </span>
        <span
          data-sla-state={live.state}
          className={cn(
            'rounded px-1 font-medium text-[11px]',
            SD_SLA_STATE_TONE[live.state],
          )}
        >
          {SD_SLA_STATE_LABEL[live.state]}
        </span>
      </div>
      <div className='flex items-baseline justify-between gap-2 tabular-nums'>
        <span className='font-semibold text-sm'>
          {live.state === 'met' && doneAt
            ? sdFormatDateTime(doneAt)
            : sdSlaShortText(live)}
        </span>
        {live.dueAt && live.state !== 'met' ? (
          <span className='text-[11px] text-muted-foreground'>
            até {sdFormatDateTime(live.dueAt)}
          </span>
        ) : null}
      </div>
      {live.state !== 'none' ? (
        <div className='h-1 overflow-hidden rounded-full bg-muted'>
          <div
            className={cn('h-full rounded-full transition-all', bar)}
            style={{ width: `${live.state === 'met' ? 100 : percent}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

export function SdUserAvatar({
  user,
  size = 'sm',
  className,
}: {
  user: Pick<SdUserSummaryDTO, 'name' | 'image'> | null
  size?: 'sm' | 'default' | 'lg'
  className?: string
}) {
  return (
    <Avatar size={size} className={className} title={user?.name}>
      {user?.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
      <AvatarFallback className='font-medium text-[10px]'>
        {user ? sdInitials(user.name) : '—'}
      </AvatarFallback>
    </Avatar>
  )
}

/** Barra fina de progresso (% da fase). */
export function SdProgressBar({
  percent,
  color,
  className,
}: {
  percent: number
  color?: string | null
  className?: string
}) {
  const value = Math.min(100, Math.max(0, percent))
  return (
    <div
      role='progressbar'
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className='h-full rounded-full bg-primary transition-all'
        style={{
          width: `${value}%`,
          ...(color ? { backgroundColor: color } : {}),
        }}
      />
    </div>
  )
}
