'use client'

import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

/**
 * Editor Tiptap montado a cada abertura do painel, garantindo que o
 * conteúdo inicial reflita `value` sem precisar de um efeito de reset.
 */
function RichTextEditor({
  initialContent,
  onReady,
}: {
  initialContent: string
  onReady: (editor: Editor | null) => void
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    immediatelyRender: false,
    onCreate: ({ editor: created }) => onReady(created),
    onDestroy: () => onReady(null),
  })

  return (
    <div className='tiptap min-h-0 flex-1 overflow-y-auto rounded-none border-0 p-4'>
      <EditorContent editor={editor} />
    </div>
  )
}

/**
 * Painel lateral com um editor de texto rico simples (Tiptap StarterKit),
 * usado pela coluna "richtext" da grade do CRM — não é o editor de blocos
 * com slash-command do CRM original (ver comentário no grid.tsx portado),
 * mas persiste HTML igual, então o valor é compatível.
 */
export function RichTextPanel({
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
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<Editor | null>(null)

  function handleSave() {
    setSaving(true)
    try {
      const html = editorRef.current?.getHTML()?.trim() ?? ''
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

        {open ? (
          <RichTextEditor
            initialContent={value}
            onReady={(editor) => {
              editorRef.current = editor
            }}
          />
        ) : null}

        <div className='flex items-center justify-end border-t p-3'>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
