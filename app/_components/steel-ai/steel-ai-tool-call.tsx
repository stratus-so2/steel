import {
  Alert02Icon,
  Clock01Icon,
  Loading03Icon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { AiToolCallDTO } from '@/types/steel-ai'

const STATUS: Record<
  AiToolCallDTO['status'],
  { icon: typeof Tick02Icon; label: string; className: string }
> = {
  running: {
    icon: Loading03Icon,
    label: 'em andamento',
    className: 'animate-spin text-muted-foreground',
  },
  done: { icon: Tick02Icon, label: 'concluída', className: 'text-primary' },
  error: { icon: Alert02Icon, label: 'falhou', className: 'text-destructive' },
  pending_confirmation: {
    icon: Clock01Icon,
    label: 'aguardando confirmação',
    className: 'text-muted-foreground',
  },
}

/** One tool call of the assistant: label, status and the result summary. */
export function SteelAiToolCall({ call }: { call: AiToolCallDTO }) {
  const status = STATUS[call.status]
  return (
    <li
      className='flex min-w-0 items-start gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs'
      data-status={call.status}
    >
      <SteelIcon
        icon={status.icon}
        strokeWidth={2}
        aria-label={status.label}
        className={cn('mt-px size-3.5 shrink-0', status.className)}
      />
      <span className='min-w-0'>
        <span className='font-medium text-foreground'>{call.label}</span>
        {call.summary ? (
          <span className='text-muted-foreground'> — {call.summary}</span>
        ) : null}
      </span>
    </li>
  )
}
