'use client'

import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { HUGEICONS_ICONS } from './hugeicons-list'
import { SectionIcon } from './section-icon'

const ICON_COLORS = [
  { color: '#5c5e63', value: 'gray' },
  { color: '#ff5b59', value: 'peach' },
  { color: '#f65385', value: 'pink' },
  { color: '#fd9038', value: 'orange' },
  { color: '#0fc27b', value: 'green' },
  { color: '#17bee9', value: 'light-blue' },
  { color: '#266df0', value: 'dark-blue' },
  { color: '#9162f9', value: 'purple' },
]

const RESULTS_CAP = 120

type HugeiconPickerProps = {
  value?: string
  onSelect: (value: string) => void
}

/**
 * Espelha `EmojiIconPicker`/`IconsTab` (app/_components/workspace/projects/
 * modal/workspace-project-modal-emoji-icon-dialog.tsx), trocando o catálogo
 * Lucide pelo catálogo completo de Hugeicons — mesmo formato de valor salvo
 * (`"<nome>:<cor>"`), mesma UX de busca + paleta de cores.
 */
export function HugeiconPicker({ value, onSelect }: HugeiconPickerProps) {
  const [search, setSearch] = useState('')
  const [color, setColor] = useState('#5c5e63')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matches = term
      ? HUGEICONS_ICONS.filter((entry) => entry.name.includes(term))
      : HUGEICONS_ICONS
    return matches.slice(0, RESULTS_CAP)
  }, [search])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='icon'
            aria-label='Escolher ícone'
          >
            <SectionIcon value={value} size={18} />
          </Button>
        }
      />
      <DropdownMenuContent className='w-auto p-2.5' align='start'>
        <div className='flex w-82.5 max-w-min flex-col gap-4'>
          <InputGroup>
            <InputGroupInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder='Pesquisar ícone'
            />
            <InputGroupAddon align='inline-start'>
              <SteelIcon icon={Search01Icon} />
            </InputGroupAddon>
          </InputGroup>

          <div className='flex w-full items-center justify-between'>
            {ICON_COLORS.map((iconColor) => (
              <button
                key={iconColor.value}
                type='button'
                onClick={() => setColor(iconColor.color)}
                className='m-0 size-6 cursor-pointer rounded border border-border p-0 hover:opacity-80'
                style={{ backgroundColor: iconColor.color }}
                aria-label={iconColor.value}
              />
            ))}
          </div>

          <div className='flex max-h-64 flex-wrap gap-3 overflow-y-auto scrollbar-hidden'>
            {filtered.map((entry) => (
              <button
                key={entry.name}
                type='button'
                onClick={() => onSelect(`${entry.name}:${color}`)}
                className='flex flex-col items-center gap-1 rounded p-2 hover:bg-accent'
                aria-label={entry.name}
              >
                <SteelIcon
                  icon={entry.icon}
                  size={20}
                  color={color}
                  strokeWidth={2}
                />
              </button>
            ))}
          </div>

          {filtered.length === RESULTS_CAP ? (
            <p className='text-center text-[11px] text-muted-foreground'>
              Mostrando os {RESULTS_CAP} primeiros — refine a busca pra ver
              mais.
            </p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
