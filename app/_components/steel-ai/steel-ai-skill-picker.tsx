'use client'

import { MagicWand01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { AiSkillDTO } from '@/types/ai-skill'

/** What the "/" picker needs from a skill. */
export type SteelAiSkillOption = Pick<
  AiSkillDTO,
  'id' | 'slug' | 'name' | 'description' | 'kind' | 'mode'
>

export const SKILL_PICKER_MAX = 8

const KIND_LABEL: Record<AiSkillDTO['kind'], string> = {
  BUILT_IN: 'Embutida',
  WORKSPACE: 'Workspace',
  PERSONAL: 'Pessoal',
}

/**
 * The command being typed: the whole draft is "/" plus an optional partial
 * slug (no space yet). Anything else closes the picker.
 */
export function skillQueryOf(value: string): string | null {
  const match = /^\/([a-z0-9-]*)$/i.exec(value)
  return match ? match[1].toLowerCase() : null
}

/** Commands starting with the query first, then name/description matches. */
export function filterSkillOptions(
  options: SteelAiSkillOption[],
  query: string,
): SteelAiSkillOption[] {
  const prefix = options.filter((o) => o.slug.startsWith(query))
  const text = options.filter(
    (o) =>
      !prefix.includes(o) &&
      query.length > 0 &&
      `${o.slug} ${o.name} ${o.description}`.toLowerCase().includes(query),
  )
  return [...prefix, ...text].slice(0, SKILL_PICKER_MAX)
}

export const skillOptionId = (listId: string, index: number) =>
  `${listId}-option-${index}`

/**
 * Listbox above the composer while the user types "/…". Keyboard handling
 * lives in the composer (the textarea keeps focus); a click picks too.
 */
export function SteelAiSkillPicker({
  id,
  options,
  activeIndex,
  onPick,
  onActiveChange,
}: {
  id: string
  options: SteelAiSkillOption[]
  activeIndex: number
  onPick: (option: SteelAiSkillOption) => void
  onActiveChange: (index: number) => void
}) {
  return (
    <div className='absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md'>
      <p className='border-border/70 border-b px-3 py-1.5 text-[11px] text-muted-foreground'>
        Skills — ↑↓ para escolher, Enter para usar, Esc para fechar
      </p>
      <div
        id={id}
        role='listbox'
        aria-label='Skills'
        className='max-h-64 overflow-y-auto p-1'
      >
        {options.map((option, index) => (
          <div
            key={option.id}
            id={skillOptionId(id, index)}
            role='option'
            aria-selected={index === activeIndex}
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onActiveChange(index)}
            onClick={() => onPick(option)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onPick(option)
            }}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm',
              index === activeIndex && 'bg-muted',
            )}
          >
            <SteelIcon
              icon={MagicWand01Icon}
              strokeWidth={2}
              aria-hidden
              className='mt-0.5 size-4 shrink-0 text-muted-foreground'
            />
            <span className='min-w-0 flex-1'>
              <span className='flex min-w-0 items-center gap-2'>
                <span className='truncate font-medium'>/{option.slug}</span>
                <span className='truncate text-muted-foreground text-xs'>
                  {option.name}
                </span>
                <span className='ml-auto shrink-0 text-[11px] text-muted-foreground'>
                  {KIND_LABEL[option.kind]}
                </span>
              </span>
              <span className='line-clamp-1 text-muted-foreground text-xs'>
                {option.description}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
