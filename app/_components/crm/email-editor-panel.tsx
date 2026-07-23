'use client'

import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded'
import * as React from 'react'
import { EmailEditorShell } from '@/app/_components/crm/email-editor-shell'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

type EditorRef = {
  getEmailHTML: () => Promise<string>
  getJSON: () => unknown
}

/**
 * Painel lateral grande com o editor de email (@react-email/editor).
 * Carrega o conteúdo inicial e devolve o HTML em `onSave`.
 */
export function EmailEditorPanel({
  open,
  onOpenChange,
  value,
  title,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  title: string
  onSave: (html: string) => void
}) {
  const ref = React.useRef<EditorRef | null>(null)
  const [saving, setSaving] = React.useState(false)

  const initialContent = React.useMemo(() => value || '', [value])

  const handleSave = async () => {
    setSaving(true)
    try {
      const html = (await ref.current?.getEmailHTML())?.trim() ?? ''
      onSave(html)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        showCloseButton={false}
        className='flex w-[640px] max-w-[640px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px] data-[side=right]:sm:max-w-[640px]'
      >
        <div className='flex items-center gap-2 border-b p-3'>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={() => onOpenChange(false)}
            aria-label='Cancelar'
          >
            <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
          <SheetTitle className='truncate capitalize'>{title}</SheetTitle>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto p-4'>
          {open ? (
            <EmailEditorShell
              ref={(r) => {
                ref.current = r as EditorRef | null
              }}
              initialContent={initialContent}
            />
          ) : null}
        </div>

        <div className='flex items-center justify-end border-t p-3'>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
