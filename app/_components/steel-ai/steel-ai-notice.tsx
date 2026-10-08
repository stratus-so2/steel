import { Alert02Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

export const STEEL_AI_DISABLED_MESSAGE =
  'O Steel AI está desligado neste workspace. Peça a um administrador para ativá-lo em Ajustes > Steel IA.'

export const STEEL_AI_AUTOPILOT_NOTICE =
  'Autopilot ligado: o Steel AI faz as alterações sem pedir confirmação — inclusive exclusões e mensagens a clientes. Tudo fica registrado no histórico de ações da IA.'

export const STEEL_AI_TEST_NOTICE =
  'Modo Teste: o Steel AI consulta os dados de verdade, mas só simula as alterações — nada é gravado nem enviado.'

export const STEEL_AI_QUOTA_MESSAGE =
  'A cota mensal de IA do workspace foi atingida. Peça a um administrador para ajustá-la em Ajustes > Steel IA ou aguarde o próximo mês.'

/**
 * Inline notice above the composer: `error` for quota, switches and
 * failures; `info` for calm status lines (e.g. Autopilot on).
 */
export function SteelAiNotice({
  children,
  action,
  tone = 'error',
  icon = Alert02Icon,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  tone?: 'error' | 'info'
  icon?: typeof Alert02Icon
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/50 text-muted-foreground',
        className,
      )}
    >
      <SteelIcon
        icon={icon}
        strokeWidth={2}
        className='mt-px size-3.5 shrink-0'
      />
      <p className='flex-1 leading-relaxed'>{children}</p>
      {action}
    </div>
  )
}
