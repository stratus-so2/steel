'use client'

import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { SdSelectOption } from '../ticket/sd-option-select'

/** Seleção múltipla com busca (filtros do quadro). */
export function SdMultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Todos',
  label,
  className,
}: {
  value: string[]
  onChange: (value: string[]) => void
  options: SdSelectOption[]
  placeholder?: string
  /** Rótulo acessível. */
  label: string
  className?: string
}) {
  const [search, setSearch] = useState('')
  const selected = options.filter((o) => value.includes(o.value))
  const visible = search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : options
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((o) => o.label).join(', ')
        : `${selected[0]?.label} +${selected.length - 1}`

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            size='sm'
            aria-label={label}
            className={cn(
              'w-full justify-between gap-2 font-normal',
              selected.length === 0 && 'text-muted-foreground',
              className,
            )}
          >
            <span className='truncate'>{summary}</span>
            <SteelIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className='size-4 shrink-0 text-muted-foreground'
            />
          </Button>
        }
      />
      <PopoverContent align='start' className='w-64 gap-2 p-2'>
        {options.length > 7 ? (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar…'
            aria-label={`Buscar em ${label}`}
            className='h-8'
          />
        ) : null}
        <div
          role='listbox'
          aria-multiselectable
          aria-label={label}
          className='flex max-h-64 flex-col overflow-y-auto'
        >
          {visible.map((o) => (
            // biome-ignore lint/a11y/noLabelWithoutControl: o Checkbox é o controle
            <label
              key={o.value}
              className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted'
              style={o.depth ? { paddingLeft: 8 + o.depth * 12 } : undefined}
            >
              <Checkbox
                checked={value.includes(o.value)}
                onCheckedChange={() => toggle(o.value)}
              />
              {o.color ? (
                <span
                  className='size-2 shrink-0 rounded-full'
                  style={{ backgroundColor: o.color }}
                />
              ) : null}
              <span className='truncate'>{o.label}</span>
              {o.hint ? (
                <span className='ml-auto text-muted-foreground text-xs'>
                  {o.hint}
                </span>
              ) : null}
            </label>
          ))}
          {visible.length === 0 ? (
            <p className='px-2 py-4 text-center text-muted-foreground text-xs'>
              Nada encontrado.
            </p>
          ) : null}
        </div>
        {value.length > 0 ? (
          <Button
            variant='ghost'
            size='xs'
            className='self-start'
            onClick={() => onChange([])}
          >
            Limpar
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
