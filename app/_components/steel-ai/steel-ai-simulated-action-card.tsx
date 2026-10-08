'use client'

import {
  Loading03Icon,
  TestTube01Icon,
  Wrench01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AiActionKindDTO, AiToolCallDTO } from '@/types/steel-ai'
import { SteelAiActionPreview } from './steel-ai-action-preview'
import { STEEL_AI_MODULE_META } from './steel-ai-starters'

const WOULD_DO: Record<AiActionKindDTO, string> = {
  CREATE: 'criaria',
  UPDATE: 'alteraria',
  DELETE: 'excluiria',
  ACTION: 'executaria',
}

/** "1 ação simulada" / "3 ações simuladas". */
export function simulatedActionsLabel(count: number): string {
  return count === 1 ? '1 ação simulada' : `${count} ações simuladas`
}

/**
 * A write simulated in Teste mode: what it would have done, with the same
 * preview the confirmation card shows — dashed and without buttons, so it
 * never reads as something that ran or that waits for a click.
 */
export function SteelAiSimulatedActionCard({
  call,
}: {
  call: AiToolCallDTO & { simulation: NonNullable<AiToolCallDTO['simulation']> }
}) {
  const { kind, preview } = call.simulation
  const moduleMeta = call.module ? STEEL_AI_MODULE_META[call.module] : null
  return (
    <article
      aria-label={`Ação simulada: ${preview.title}`}
      data-status='simulated'
      className='w-full max-w-xl space-y-3 rounded-xl border border-border border-dashed bg-muted/30 p-3.5 text-card-foreground sm:p-4'
    >
      <header className='space-y-1.5'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
          <Badge variant='outline' className='gap-1'>
            <SteelIcon
              icon={TestTube01Icon}
              strokeWidth={2}
              className='size-3'
            />
            Simulado
          </Badge>
          <span className='text-muted-foreground'>
            nada foi alterado · {WOULD_DO[kind]}
          </span>
          {moduleMeta ? (
            <span className='inline-flex items-center gap-1 text-muted-foreground'>
              <SteelIcon
                icon={moduleMeta.icon}
                strokeWidth={2}
                className='size-3.5'
              />
              {moduleMeta.label}
            </span>
          ) : null}
        </div>
        <h3 className='font-semibold text-sm leading-snug [overflow-wrap:anywhere]'>
          <span className='text-muted-foreground'>Faria: </span>
          {preview.title}
        </h3>
      </header>
      <SteelAiActionPreview preview={preview} />
    </article>
  )
}

/**
 * End of a Teste turn: how many writes were simulated, and the way out —
 * "Executar de verdade em Build" switches the conversation to Build and
 * re-sends the request, so every write goes through the normal
 * confirmation (the simulation itself never executes anything).
 */
export function SteelAiSimulationSummary({
  count,
  onRunForReal,
  runForRealDisabledReason,
  busy,
  className,
}: {
  count: number
  /** Absent on older turns: only the last one offers the button. */
  onRunForReal?: () => void
  /** Why Build is unavailable (agent mode switched off), if it is. */
  runForRealDisabledReason?: string | null
  busy?: boolean
  className?: string
}) {
  return (
    <div
      role='status'
      className={cn(
        'flex w-full max-w-xl flex-col gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className='flex items-start gap-1.5 text-muted-foreground leading-relaxed'>
        <SteelIcon
          icon={TestTube01Icon}
          strokeWidth={2}
          className='mt-px size-3.5 shrink-0'
        />
        <span>
          Em modo teste: {simulatedActionsLabel(count)}, nada foi alterado.
          {onRunForReal && runForRealDisabledReason ? (
            <> {runForRealDisabledReason}</>
          ) : null}
        </span>
      </p>
      {onRunForReal && !runForRealDisabledReason ? (
        <Button
          size='sm'
          variant='outline'
          className='shrink-0 bg-background'
          disabled={busy}
          onClick={onRunForReal}
        >
          <SteelIcon
            icon={busy ? Loading03Icon : Wrench01Icon}
            strokeWidth={2}
            className={cn(busy && 'motion-safe:animate-spin')}
          />
          Executar de verdade em Build
        </Button>
      ) : null}
    </div>
  )
}
