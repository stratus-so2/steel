'use client'

import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type KeyboardEvent, useId, useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { type DocsSearchable, searchDocs } from '@/src/lib/docs/search'

interface DocsSearchProps {
  index: DocsSearchable[]
  /** Called after a result is opened (the mobile sheet closes itself). */
  onNavigate?: () => void
}

export function DocsSearch({ index, onNavigate }: DocsSearchProps) {
  const router = useRouter()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => searchDocs(index, query), [index, query])
  const open = query.trim().length > 0

  function reset() {
    setQuery('')
    setActive(0)
    onNavigate?.()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setQuery('')
      return
    }
    if (results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      router.push(results[Math.min(active, results.length - 1)].href)
      reset()
    }
  }

  return (
    <div className='relative'>
      <SteelIcon
        icon={Search01Icon}
        size={16}
        className='pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground'
      />
      <Input
        type='search'
        role='combobox'
        aria-label='Buscar na documentação'
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete='list'
        placeholder='Buscar na documentação'
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        className='pl-8'
      />
      {open && (
        <div
          id={listId}
          className='absolute inset-x-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md'
        >
          {results.length === 0 ? (
            <p className='px-2 py-3 text-sm text-muted-foreground'>
              Nada encontrado para “{query.trim()}”.
            </p>
          ) : (
            <ul aria-label='Resultados da busca'>
              {results.map((result, position) => (
                <li key={result.href}>
                  <Link
                    href={result.href}
                    onClick={reset}
                    onMouseEnter={() => setActive(position)}
                    aria-current={position === active ? 'true' : undefined}
                    className={cn(
                      'flex flex-col gap-0.5 rounded-sm px-2 py-2 text-sm',
                      position === active && 'bg-accent',
                    )}
                  >
                    <span className='font-medium text-primary'>
                      {result.title}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {result.section} · {result.excerpt}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
