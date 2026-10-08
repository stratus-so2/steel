import { cn } from '@/lib/utils'
import type { ChangelogEntryHeading } from '@/types/changelog-entry'

const HEADING_INDENT: Record<ChangelogEntryHeading['level'], string> = {
  2: '',
  3: 'pl-4',
}

interface TableOfContentsProps {
  headings: ChangelogEntryHeading[]
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  if (headings.length === 0) return null

  return (
    <nav aria-label='Nesta novidade' className='py-6 border-y border-border'>
      <span className='text-sm font-medium'>Nesta novidade</span>
      <ul className='mt-3 space-y-2 text-sm text-muted-foreground'>
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={cn(
              HEADING_INDENT[heading.level],
              'hover:text-foreground transition-colors hover:underline',
            )}
          >
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
