'use client'

import {
  ActivityIcon,
  Alert02Icon,
  Timer02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  SD_RISK_LEVEL_LABEL,
  SD_RISK_THRESHOLDS,
} from '@/src/lib/servicedesk/risk'
import type { SdRiskFactorDTO, SdTicketRiskDTO } from '@/types/sd-risk'
import { sdRelativeTime } from '../ticket/sd-ticket-meta'

/**
 * Selo de risco preditivo. **Nunca mostra a nota sem o motivo** (ADR 0016):
 * os fatores que pegaram vão no tooltip (e no `aria-label`), e o widget da
 * tela do chamado os lista abertos.
 *
 * As cores seguem a tabela compartilhada (`src/lib/servicedesk/risk.ts`) e
 * foram escritas por extenso porque o Tailwind não monta classe dinâmica —
 * todas legíveis no claro, no escuro e no fundo escuro do modo TV.
 */

export const SD_RISK_TONE: Record<SdTicketRiskDTO['level'], string> = {
  LOW: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300',
  MEDIUM:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-300',
  HIGH: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:border-rose-400/40 dark:text-rose-300',
}

const SD_RISK_BAR: Record<SdTicketRiskDTO['level'], string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-rose-500',
}

const SD_RISK_ICON = {
  LOW: ActivityIcon,
  MEDIUM: Timer02Icon,
  HIGH: Alert02Icon,
} as const

/** "82% do prazo consumido · Sem responsável há 3 h" (até 3 fatores). */
export function sdRiskReason(factors: SdRiskFactorDTO[], max = 3): string {
  return factors
    .slice(0, max)
    .map((f) => f.detail)
    .join(' · ')
}

export function SdRiskFactorList({
  factors,
  className,
}: {
  factors: SdRiskFactorDTO[]
  className?: string
}) {
  if (factors.length === 0) return null
  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {factors.map((factor) => (
        <li key={factor.key} className='flex items-start gap-1.5 text-xs'>
          <span className='mt-1 size-1.5 shrink-0 rounded-full bg-current opacity-60' />
          <span className='min-w-0 flex-1'>
            <span className='font-medium'>{factor.label}</span>
            <span className='text-muted-foreground'> — {factor.detail}</span>
          </span>
          <span className='shrink-0 font-medium tabular-nums'>
            +{factor.weight}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Chip do quadro, da lista e da tabela. Por padrão só aparece de `MEDIUM`
 * para cima (um selo verde em todo cartão é ruído); `showLow` liga a faixa
 * baixa. Sem fator que explique, não há selo.
 */
export function SdRiskBadge({
  risk,
  compact,
  showLow,
  className,
}: {
  risk: SdTicketRiskDTO | null | undefined
  compact?: boolean
  showLow?: boolean
  className?: string
}) {
  if (!risk || risk.factors.length === 0) return null
  if (risk.level === 'LOW' && !showLow) return null
  const label = SD_RISK_LEVEL_LABEL[risk.level]
  const reason = sdRiskReason(risk.factors)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-risk-level={risk.level}
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded-md border px-1.5 font-medium text-[11px] tabular-nums',
              SD_RISK_TONE[risk.level],
              className,
            )}
          >
            <SteelIcon
              icon={SD_RISK_ICON[risk.level]}
              strokeWidth={2}
              className='size-3'
            />
            <span aria-hidden>
              {compact ? risk.score : `${label} · ${risk.score}`}
            </span>
            <span className='sr-only'>
              {`${label}, nota ${risk.score} de 100: ${reason}`}
            </span>
          </span>
        }
      />
      <TooltipContent className='max-w-xs'>
        <p className='font-medium'>
          {label} — {risk.score}/100
        </p>
        <SdRiskFactorList factors={risk.factors} className='mt-1' />
        {risk.breachEtaAt ? (
          <p className='mt-1 text-muted-foreground text-xs'>
            Previsão de estouro do prazo{' '}
            {sdRelativeTime(risk.breachEtaAt, new Date())}.
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Widget da tela do chamado: nota, barra, previsão de estouro e os fatores
 * **abertos** (sem precisar passar o mouse).
 */
export function SdRiskWidget({
  risk,
  now = new Date(),
  className,
}: {
  risk: SdTicketRiskDTO | null | undefined
  now?: Date
  className?: string
}) {
  if (!risk) return null
  const label = SD_RISK_LEVEL_LABEL[risk.level]
  const percent = Math.min(100, Math.max(0, risk.score))
  return (
    <section
      data-risk-level={risk.level}
      aria-label='Risco preditivo'
      className={cn(
        'flex min-w-60 flex-1 flex-col gap-1.5 rounded-lg border bg-card/60 px-2.5 py-1.5',
        className,
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <span className='font-medium text-[11px] text-muted-foreground uppercase tracking-wide'>
          Risco preditivo
        </span>
        <span
          className={cn(
            'rounded border px-1 font-medium text-[11px]',
            SD_RISK_TONE[risk.level],
          )}
        >
          {label}
        </span>
      </div>
      <div className='flex items-baseline justify-between gap-2 tabular-nums'>
        <span className='font-semibold text-sm'>{risk.score}/100</span>
        {risk.breachEtaAt ? (
          <span className='text-[11px] text-muted-foreground'>
            estoura {sdRelativeTime(risk.breachEtaAt, now)}
          </span>
        ) : null}
      </div>
      <div className='h-1 overflow-hidden rounded-full bg-muted'>
        <div
          className={cn(
            'h-full rounded-full transition-all',
            SD_RISK_BAR[risk.level],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {risk.factors.length > 0 ? (
        <SdRiskFactorList factors={risk.factors} />
      ) : (
        <p className='text-[11px] text-muted-foreground'>
          Nenhum fator de risco neste chamado.
        </p>
      )}
      <p className='text-[10px] text-muted-foreground'>
        Faixas: médio a partir de {SD_RISK_THRESHOLDS.medium}, alto a partir de{' '}
        {SD_RISK_THRESHOLDS.high}.
      </p>
    </section>
  )
}
