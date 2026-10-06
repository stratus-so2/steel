import { Alert02Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

export const STEEL_AI_QUOTA_MESSAGE =
  'A cota mensal de IA do workspace foi atingida. Peça a um administrador para ajustá-la em Ajustes > Steel IA ou aguarde o próximo mês.'

/** Inline error/warning above the composer (quota, disabled mode, failures). */
export function SteelAiNotice({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role='alert'
      className={cn(
        'flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-xs',
        className,
      )}
    >
      <SteelIcon
        icon={Alert02Icon}
        strokeWidth={2}
        className='mt-px size-3.5 shrink-0'
      />
      <p className='flex-1 leading-relaxed'>{children}</p>
      {action}
    </div>
  )
}
