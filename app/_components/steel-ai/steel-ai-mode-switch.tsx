'use client'

import { AiMagicIcon, Compass01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AiConversationModeDTO } from '@/types/steel-ai'

export const AGENT_MODE_DISABLED_HINT =
  'O modo Agente foi desativado por um administrador em Ajustes > Steel IA.'

const MODES: {
  value: AiConversationModeDTO
  label: string
  hint: string
  icon: typeof Compass01Icon
}[] = [
  {
    value: 'EXPLORE',
    label: 'Explorar',
    hint: 'Só responde e consulta dados — não altera nada.',
    icon: Compass01Icon,
  },
  {
    value: 'AGENT',
    label: 'Agente',
    hint: 'Propõe criar, alterar ou excluir registros. Nada é feito sem a sua confirmação.',
    icon: AiMagicIcon,
  },
]

/** Explorar | Agente. Agente is disabled (with the reason) when turned off. */
export function SteelAiModeSwitch({
  value,
  onChange,
  agentModeEnabled,
  disabled,
  className,
}: {
  value: AiConversationModeDTO
  onChange: (mode: AiConversationModeDTO) => void
  agentModeEnabled: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <fieldset
      aria-label='Modo do Steel AI'
      className={cn(
        'm-0 inline-flex h-7 min-w-0 items-center gap-0.5 rounded-md border-0 bg-muted p-0.5',
        className,
      )}
    >
      {MODES.map((mode) => {
        const locked = mode.value === 'AGENT' && !agentModeEnabled
        const checked = value === mode.value
        const button = (
          <button
            type='button'
            aria-pressed={checked}
            disabled={disabled || locked}
            onClick={() => onChange(mode.value)}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-[5px] px-2 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
              checked && 'bg-background text-foreground shadow-xs',
            )}
          >
            <SteelIcon icon={mode.icon} strokeWidth={2} className='size-3.5' />
            {mode.label}
          </button>
        )
        return (
          <Tooltip key={mode.value}>
            <TooltipTrigger
              render={
                <span className='inline-flex' tabIndex={locked ? 0 : -1} />
              }
            >
              {button}
            </TooltipTrigger>
            <TooltipContent side='top'>
              {locked ? AGENT_MODE_DISABLED_HINT : mode.hint}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </fieldset>
  )
}
