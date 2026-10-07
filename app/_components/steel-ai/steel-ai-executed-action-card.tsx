'use client'

import {
  Airplane01Icon,
  Alert02Icon,
  ArrowRight01Icon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { AiActionKindDTO, AiPendingActionDTO } from '@/types/steel-ai'

const KIND_LABEL: Record<AiActionKindDTO, string> = {
  CREATE: 'Criado',
  UPDATE: 'Alterado',
  DELETE: 'Excluído',
  ACTION: 'Executado',
}

/**
 * A write the Autopilot already ran: one compact row (no buttons) with the
 * outcome, what was done and a link to the record when there is one.
 */
export function SteelAiExecutedActionCard({
  action,
}: {
  action: AiPendingActionDTO
}) {
  const failed = action.status === 'FAILED'
  const href = action.preview.target?.href
  const detail = failed
    ? (action.error ?? 'A execução falhou.')
    : (action.resultSummary ?? action.preview.summary)

  return (
    <article
      aria-label={`Ação executada pelo Autopilot: ${action.preview.title}`}
      data-status={action.status}
      className={cn(
        'flex w-full max-w-xl items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-card-foreground',
        failed ? 'border-destructive/40' : 'border-border/80',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
          failed
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary',
        )}
      >
        <SteelIcon
          icon={failed ? Alert02Icon : Tick02Icon}
          strokeWidth={2}
          className='size-3.5'
        />
      </span>
      <div className='min-w-0 flex-1 space-y-0.5'>
        <p className='flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs'>
          <span className='inline-flex items-center gap-1'>
            <SteelIcon
              icon={Airplane01Icon}
              strokeWidth={2}
              className='size-3'
            />
            Autopilot
          </span>
          <span aria-hidden>·</span>
          <span className={cn(failed && 'text-destructive')}>
            {failed ? 'Falhou' : KIND_LABEL[action.kind]}
          </span>
        </p>
        <p className='font-medium text-sm leading-snug [overflow-wrap:anywhere]'>
          {action.preview.title}
        </p>
        {detail ? (
          <p
            role={failed ? 'alert' : undefined}
            className={cn(
              'text-xs leading-relaxed [overflow-wrap:anywhere]',
              failed ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {detail}
          </p>
        ) : null}
      </div>
      {href && !failed && action.kind !== 'DELETE' ? (
        <Link
          href={href}
          aria-label='Abrir registro'
          className='mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground'
        >
          <SteelIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className='size-4'
          />
        </Link>
      ) : null}
    </article>
  )
}
