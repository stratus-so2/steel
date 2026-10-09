'use client'

import type { IconSvgElement } from '@hugeicons/react'
import {
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import { CAMPAIGN_LINK } from '@/src/lib/crm-email-builder/variables'
import { isEmailBuilderLink } from '@/src/schemas/crm-email-builder.schema'
import { VariablePicker } from './variable-picker'

function ToolbarButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: IconSvgElement
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
        active && 'bg-muted text-foreground',
      )}
    >
      <SteelIcon icon={icon} strokeWidth={2} className='size-4' />
    </button>
  )
}

/**
 * Paragraph rich text (TipTap, the engine of `@react-email/editor`) limited
 * to what e-mail clients render: bold, italic, underline, strike, links and
 * lists. The server sanitizes the HTML again before rendering.
 */
export function RichTextField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (html: string) => void
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          isAllowedUri: (url) => isEmailBuilderLink(url),
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        'aria-label': 'Texto',
        class:
          'min-h-24 px-3 py-2 text-sm outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.isEmpty ? '' : current.getHTML())
    },
  })

  // Undo/redo and section switches change `value` from outside.
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt(
      'Endereço do link (https://…). Deixe em branco para usar o link da campanha.',
      '',
    )
    if (url === null) return
    const href = url.trim() || CAMPAIGN_LINK
    if (!isEmailBuilderLink(href)) return
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  return (
    <div className='overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/40'>
      <div className='flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1 py-1'>
        <ToolbarButton
          label='Negrito'
          icon={TextBoldIcon}
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label='Itálico'
          icon={TextItalicIcon}
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label='Sublinhado'
          icon={TextUnderlineIcon}
          active={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label='Tachado'
          icon={TextStrikethroughIcon}
          active={editor?.isActive('strike')}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          label='Link'
          icon={Link01Icon}
          active={editor?.isActive('link')}
          onClick={toggleLink}
        />
        <ToolbarButton
          label='Lista'
          icon={LeftToRightListBulletIcon}
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label='Lista numerada'
          icon={LeftToRightListNumberIcon}
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <div className='ml-auto'>
          <VariablePicker
            onPick={(token) =>
              editor?.chain().focus().insertContent(token).run()
            }
          />
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
