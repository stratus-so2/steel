'use client'

import { BracesIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { EMAIL_VARIABLES } from '@/src/lib/crm-email-builder/variables'

/** Personalization variables (`{{nome}}`…) for text fields. */
export function VariablePicker({
  onPick,
  label = 'Inserir variável',
}: {
  onPick: (token: string) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const variables = EMAIL_VARIABLES.filter((v) => v.pickable && !v.link)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label={label}
            title={label}
          >
            <SteelIcon icon={BracesIcon} strokeWidth={2} />
          </Button>
        }
      />
      <PopoverContent align='end' className='w-60 p-1'>
        <p className='px-2 py-1.5 text-muted-foreground text-xs'>
          Preenchidas com os dados de cada contato
        </p>
        <ul>
          {variables.map((variable) => (
            <li key={variable.key}>
              <button
                type='button'
                className='flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted'
                onClick={() => {
                  onPick(`{{${variable.key}}}`)
                  setOpen(false)
                }}
              >
                <span>{variable.label}</span>
                <code className='text-muted-foreground text-xs'>
                  {`{{${variable.key}}}`}
                </code>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** Inserts `token` at the caret of an input/textarea value. */
export function insertAtCaret(
  element: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  token: string,
): string {
  if (!element || element.selectionStart === null) return `${value}${token}`
  const start = element.selectionStart
  const end = element.selectionEnd ?? start
  return `${value.slice(0, start)}${token}${value.slice(end)}`
}
