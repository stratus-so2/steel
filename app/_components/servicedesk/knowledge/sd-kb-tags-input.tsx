'use client'

import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'

const MAX_TAGS = 20

/** Tags do artigo: Enter ou vírgula adiciona, × remove (normaliza minúsculas). */
export function SdKbTagsInput({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const tag = raw.trim().toLowerCase().slice(0, 40)
    setDraft('')
    if (!tag || value.includes(tag) || value.length >= MAX_TAGS) return
    onChange([...value, tag])
  }

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {value.map((tag) => (
        <Badge key={tag} variant='secondary' className='gap-1 pr-1'>
          {tag}
          {!disabled && (
            <button
              type='button'
              aria-label={`Remover tag ${tag}`}
              className='rounded-sm hover:bg-background/60'
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              <SteelIcon icon={Cancel01Icon} size={10} strokeWidth={2} />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && value.length < MAX_TAGS && (
        <input
          aria-label='Adicionar tag'
          value={draft}
          placeholder={value.length ? '+ tag' : 'Adicionar tags…'}
          onChange={(e) => {
            const next = e.target.value
            if (next.endsWith(',')) add(next.slice(0, -1))
            else setDraft(next)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => draft && add(draft)}
          className='h-6 min-w-24 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground'
        />
      )}
    </div>
  )
}
