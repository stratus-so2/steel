'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import { READONLY_RICH_TEXT_EXTENSIONS } from '@/app/_components/crm/rich-text/tiptap-extensions'

/** Render read-only do conteúdo da proposta na página pública. */
export function ProposalViewer({ content }: { content: string }) {
  const editor = useEditor({
    extensions: READONLY_RICH_TEXT_EXTENSIONS,
    content: content || '',
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap focus:outline-none' },
    },
  })

  return <EditorContent editor={editor} />
}
