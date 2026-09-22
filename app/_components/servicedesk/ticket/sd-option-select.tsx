'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface SdSelectOption {
  value: string
  label: string
  color?: string | null
  /** Texto auxiliar à direita (ex.: nível). */
  hint?: string | null
  /** Indentação (árvores de 2 níveis). */
  depth?: number
  disabled?: boolean
}

const NONE = '__none'

/**
 * Select controlado por id, com opção "nenhum" (limpar), bolinha de cor e
 * indentação. Base dos campos de lista do chamado e dos campos
 * customizados.
 */
export function SdOptionSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecionar…',
  noneLabel = 'Nenhum',
  allowClear = true,
  disabled,
  id,
  className,
  size = 'sm',
  'aria-label': ariaLabel,
}: {
  value: string | null | undefined
  onChange: (value: string | null) => void
  options: SdSelectOption[]
  placeholder?: string
  noneLabel?: string
  allowClear?: boolean
  disabled?: boolean
  id?: string
  className?: string
  size?: 'sm' | 'default'
  'aria-label'?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) =>
        onChange(!next || next === NONE ? null : String(next))
      }
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={cn('w-full min-w-0', className)}
      >
        <span
          className={cn(
            'flex min-w-0 items-center gap-1.5 truncate',
            !current && 'text-muted-foreground',
          )}
        >
          {current?.color ? (
            <span
              className='size-2 shrink-0 rounded-full'
              style={{ backgroundColor: current.color }}
            />
          ) : null}
          <span className='truncate'>
            {current?.label ?? (value ? '…' : placeholder)}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent className='max-h-80'>
        {allowClear ? (
          <SelectItem value={NONE}>
            <span className='text-muted-foreground'>{noneLabel}</span>
          </SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            <span
              className='flex min-w-0 items-center gap-1.5'
              style={
                option.depth ? { paddingLeft: option.depth * 12 } : undefined
              }
            >
              {option.color ? (
                <span
                  className='size-2 shrink-0 rounded-full'
                  style={{ backgroundColor: option.color }}
                />
              ) : null}
              <span className='truncate'>{option.label}</span>
              {option.hint ? (
                <span className='text-muted-foreground text-xs'>
                  {option.hint}
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
