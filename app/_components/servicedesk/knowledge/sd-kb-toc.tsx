'use client'

import type { Value } from 'platejs'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { sdKbHeadings } from './sd-kb-utils'

/**
 * Sumário do artigo (H1–H3). Rola até o n-ésimo título renderizado dentro
 * de `containerSelector` (editor ou leitura).
 */
export function SdKbToc({
  content,
  containerSelector,
  className,
}: {
  content: Value
  containerSelector: string
  className?: string
}) {
  const headings = useMemo(() => sdKbHeadings(content), [content])
  if (headings.length === 0) return null

  function scrollTo(index: number) {
    const container = document.querySelector(containerSelector)
    const target = container?.querySelectorAll('h1, h2, h3')[index]
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav aria-label='Sumário' className={cn('space-y-1', className)}>
      <p className='font-medium text-muted-foreground text-xs uppercase tracking-wide'>
        Neste artigo
      </p>
      <ul className='space-y-0.5'>
        {headings.map((heading) => (
          <li key={`${heading.index}-${heading.text}`}>
            <button
              type='button'
              onClick={() => scrollTo(heading.index)}
              className={cn(
                'w-full truncate rounded px-1.5 py-0.5 text-left text-muted-foreground text-sm hover:bg-muted hover:text-foreground',
                heading.level === 2 && 'pl-4',
                heading.level === 3 && 'pl-7 text-xs',
              )}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
