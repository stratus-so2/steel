import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import type { DocsPageMeta } from '@/src/lib/docs/pages'

interface DocsPagerProps {
  prev: Pick<DocsPageMeta, 'href' | 'title'> | null
  next: Pick<DocsPageMeta, 'href' | 'title'> | null
}

export function DocsPager({ prev, next }: DocsPagerProps) {
  if (!prev && !next) return null

  return (
    <nav
      aria-label='Navegação entre páginas'
      className='grid grid-cols-1 gap-4 border-t border-border pt-8 sm:grid-cols-2'
    >
      {prev ? (
        <Link
          href={prev.href}
          rel='prev'
          className='flex flex-col gap-1 rounded-md border border-border p-4 transition-colors hover:bg-card'
        >
          <span className='flex items-center gap-1 text-xs text-muted-foreground'>
            <SteelIcon icon={ArrowLeft01Icon} size={14} />
            Anterior
          </span>
          <span className='text-sm font-medium'>{prev.title}</span>
        </Link>
      ) : (
        <span className='hidden sm:block' />
      )}
      {next && (
        <Link
          href={next.href}
          rel='next'
          className='flex flex-col items-end gap-1 rounded-md border border-border p-4 text-right transition-colors hover:bg-card'
        >
          <span className='flex items-center gap-1 text-xs text-muted-foreground'>
            Próxima
            <SteelIcon icon={ArrowRight01Icon} size={14} />
          </span>
          <span className='text-sm font-medium'>{next.title}</span>
        </Link>
      )}
    </nav>
  )
}
