'use client'

import { AiChipIcon, ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { AiChatModelDTO } from '@/types/steel-ai'

const usd = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

/** "US$ 0,15 / US$ 0,60" — input / output per 1M tokens. */
export function formatModelPrice(model: AiChatModelDTO): string {
  return `${usd.format(model.inputUsdPer1M)} / ${usd.format(model.outputUsdPer1M)}`
}

/** Picker groups, in the order the server lists the models. */
function byProvider(models: AiChatModelDTO[]) {
  const groups: { label: string; models: AiChatModelDTO[] }[] = []
  for (const model of models) {
    const group = groups.find((g) => g.label === model.providerLabel)
    if (group) group.models.push(model)
    else groups.push({ label: model.providerLabel, models: [model] })
  }
  return groups
}

/**
 * Model of the conversation: the workspace's enabled models grouped by
 * provider, each with its price per 1M tokens (input / output). Hidden when
 * there is nothing to choose from.
 */
export function SteelAiModelPicker({
  models,
  value,
  onChange,
  disabled,
  className,
}: {
  models: AiChatModelDTO[]
  /** Selected key; a key outside `models` shows the first model. */
  value: string | null
  onChange: (modelKey: string) => void
  disabled?: boolean
  className?: string
}) {
  if (models.length === 0) return null
  const current = models.find((m) => m.key === value) ?? models[0]
  const groups = byProvider(models)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Modelo: ${current.label}`}
        className={cn(
          'inline-flex h-7 min-w-0 items-center gap-1 rounded-md px-1.5 font-medium text-muted-foreground text-xs outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted data-popup-open:text-foreground',
          className,
        )}
      >
        <SteelIcon
          icon={AiChipIcon}
          strokeWidth={2}
          className='hidden size-3.5 shrink-0 sm:block'
        />
        <span className='truncate'>{current.label}</span>
        <SteelIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className='size-3 shrink-0'
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side='top'
        align='start'
        className='w-72 max-w-[calc(100vw-2rem)]'
      >
        <DropdownMenuRadioGroup
          value={current.key}
          onValueChange={(key) => onChange(String(key))}
        >
          {groups.map((group, index) => (
            <DropdownMenuGroup key={group.label}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.models.map((model) => (
                <DropdownMenuRadioItem key={model.key} value={model.key}>
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate'>{model.label}</span>
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      {formatModelPrice(model)} por 1M tokens
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
        <p className='px-2 pt-1 pb-1.5 text-[11px] text-muted-foreground leading-snug'>
          Preço de entrada / saída cobrado da cota do workspace.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
