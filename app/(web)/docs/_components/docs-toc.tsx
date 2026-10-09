'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { MdxHeading } from '@/src/lib/mdx/headings'

interface DocsTocProps {
  headings: MdxHeading[]
  /** Hidden when a wrapper (the mobile disclosure) already says it. */
  showTitle?: boolean
}

/** "Nesta página": the page's headings, highlighting the one in view. */
export function DocsToc({ headings, showTitle = true }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '-80px 0px -70% 0px' },
    )
    for (const heading of headings) {
      const element = document.getElementById(heading.id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav aria-label='Nesta página' className='flex flex-col gap-3'>
      {showTitle && <span className='text-sm font-medium'>Nesta página</span>}
      <ul className='flex flex-col gap-2 text-sm'>
        {headings.map((heading) => (
          <li key={heading.id} className={cn(heading.level === 3 && 'pl-3')}>
            <a
              href={`#${heading.id}`}
              aria-current={activeId === heading.id ? 'location' : undefined}
              className={cn(
                'transition-colors hover:text-primary',
                activeId === heading.id
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
