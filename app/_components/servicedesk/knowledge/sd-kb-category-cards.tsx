'use client'

import { Folder01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { SdKbCategoryDTO } from '@/types/sd-kb-article'

/** Cartões das categorias do catálogo (clique filtra a busca). */
export function SdKbCategoryCards({
  categories,
  selectedId,
  onSelect,
}: {
  categories: SdKbCategoryDTO[]
  selectedId?: string
  onSelect: (categoryId: string | undefined) => void
}) {
  const visible = categories.filter(
    (c) => c.articleCount > 0 || c.id === selectedId,
  )
  if (visible.length === 0) return null

  return (
    <ul className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      {visible.map((category) => {
        const active = category.id === selectedId
        return (
          <li key={category.id}>
            <button
              type='button'
              aria-pressed={active}
              onClick={() => onSelect(active ? undefined : category.id)}
              className={cn(
                'flex h-full w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40',
                active && 'border-primary ring-1 ring-primary',
              )}
            >
              <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg text-primary'>
                {category.icon ?? (
                  <SteelIcon icon={Folder01Icon} strokeWidth={2} />
                )}
              </span>
              <span className='min-w-0'>
                <span className='block truncate font-medium text-sm'>
                  {category.name}
                </span>
                {category.description && (
                  <span className='line-clamp-2 text-muted-foreground text-xs'>
                    {category.description}
                  </span>
                )}
                <span className='mt-1 block text-muted-foreground text-xs'>
                  {category.articleCount}{' '}
                  {category.articleCount === 1 ? 'artigo' : 'artigos'}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
