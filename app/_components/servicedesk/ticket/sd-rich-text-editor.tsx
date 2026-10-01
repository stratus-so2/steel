'use client'

import type { IconSvgElement } from '@hugeicons/react'
import {
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteDownIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { Placeholder } from '@tiptap/extension-placeholder'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

function ToolbarButton({
  editor,
  label,
  icon,
  active,
  run,
}: {
  editor: Editor
  label: string
  icon: IconSvgElement
  active: boolean
  run: (editor: Editor) => void
}) {
  return (
    <button
      type='button'
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(editor)}
      className={cn(
        'rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground',
        active && 'bg-muted text-foreground',
      )}
    >
      <SteelIcon icon={icon} strokeWidth={2} className='size-4' />
    </button>
  )
}

/**
 * Editor de texto rico compacto (Tiptap StarterKit) para a descrição do
 * chamado. Emite HTML — o servidor sanitiza (`sanitizeSdHtml`).
 */
export function SdRichTextEditor({
  value,
  onChange,
  placeholder = 'Descreva o que aconteceu, impacto, passos para reproduzir…',
  className,
  minHeight = 140,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': 'Descrição',
        class:
          'prose prose-sm dark:prose-invert max-w-none px-3 py-2 outline-none',
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: current }) =>
      onChange(current.isEmpty ? '' : current.getHTML()),
  })

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border bg-transparent focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30',
        className,
      )}
    >
      {editor ? (
        <div className='flex items-center gap-0.5 border-b px-1.5 py-1'>
          <ToolbarButton
            editor={editor}
            label='Negrito'
            icon={TextBoldIcon}
            active={editor.isActive('bold')}
            run={(e) => e.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            editor={editor}
            label='Itálico'
            icon={TextItalicIcon}
            active={editor.isActive('italic')}
            run={(e) => e.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            editor={editor}
            label='Tachado'
            icon={TextStrikethroughIcon}
            active={editor.isActive('strike')}
            run={(e) => e.chain().focus().toggleStrike().run()}
          />
          <span className='mx-1 h-4 w-px bg-border' />
          <ToolbarButton
            editor={editor}
            label='Lista'
            icon={LeftToRightListBulletIcon}
            active={editor.isActive('bulletList')}
            run={(e) => e.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            editor={editor}
            label='Lista numerada'
            icon={LeftToRightListNumberIcon}
            active={editor.isActive('orderedList')}
            run={(e) => e.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            editor={editor}
            label='Citação'
            icon={QuoteDownIcon}
            active={editor.isActive('blockquote')}
            run={(e) => e.chain().focus().toggleBlockquote().run()}
          />
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}

/** HTML sanitizado no servidor (descrição do chamado) em modo leitura. */
export function SdRichTextView({
  html,
  className,
}: {
  html: string | null
  className?: string
}) {
  if (!html) {
    return (
      <p className={cn('text-muted-foreground text-sm italic', className)}>
        Sem descrição.
      </p>
    )
  }
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none break-words',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
