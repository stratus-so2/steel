'use client'

import { KEYS, type Value } from 'platejs'
import { Plate, usePlateEditor } from 'platejs/react'
import type { ReactNode } from 'react'
import { Editor, EditorContainer } from '@/components/editor/ui/editor'
import { FixedToolbar } from '@/components/editor/ui/fixed-toolbar'
import { FixedToolbarButtons } from '@/components/editor/ui/fixed-toolbar-buttons'
import { cn } from '@/lib/utils'
import { sdKbEditorBackend } from '@/src/hooks/sd-kb-editor-backend'
import { EditorDocumentProvider } from './editor-document-context'
import { KB_EDITOR_PLUGINS } from './kb-plugins'

/**
 * Editor da base de conhecimento do ServiceDesk — port do `WikiPageRichEditor`
 * do Nexo (mesmos kits: blocos, listas, código, colunas, toggle, sumário,
 * mídia, link, data, equação, emoji, menção, slash, tabela, diagramas de
 * código, notas de rodapé, markdown/docx, comentários/discussões, alinhamento,
 * fonte, altura de linha, menu de bloco, arrastar e soltar e as barras fixa e
 * flutuante). Diferenças: sem Yjs/Hocuspocus (o autosave é o JSON do
 * conteúdo, como o `content` da Wiki) e sem o bloco Excalidraw.
 *
 * Layout: the fixed toolbar is rendered here (not through `FixedToolbarKit`)
 * as a full-width bar that never scrolls; below it a single scroll area holds
 * the `header` slot (cover, title) and the text, both in the same centered
 * column.
 */

/** Text column: up to 900px, with a 64px gutter for the drag handles. */
export const KB_EDITOR_COLUMN = 'mx-auto w-full max-w-[calc(900px+8rem)] px-16'

interface KbRichEditorProps {
  workspaceId: string
  articleId: string
  userId: string
  userName: string
  content: Value
  onChange: (content: Value) => void
  /** Rendered above the text, inside the scroll area (cover, title…). */
  header?: ReactNode
  className?: string
}

export function KbRichEditor({
  workspaceId,
  articleId,
  userId,
  userName,
  content,
  onChange,
  header,
  className,
}: KbRichEditorProps) {
  const editor = usePlateEditor({
    plugins: KB_EDITOR_PLUGINS,
    value: content,
  })

  return (
    <EditorDocumentProvider
      workspaceId={workspaceId}
      documentId={articleId}
      userId={userId}
      userName={userName}
      backend={sdKbEditorBackend}
    >
      <Plate
        editor={editor}
        onChange={({ value }) => {
          // Ctrl+A → Del pode zerar editor.children antes da normalização:
          // documento vazio quebra a renderização e não deve ir ao autosave.
          if (value.length === 0) {
            editor.tf.insertNodes(editor.api.create.block({ type: KEYS.p }), {
              at: [0],
            })
            return
          }
          onChange(value)
        }}
      >
        <div className={cn('flex h-full min-h-0 flex-col', className)}>
          <FixedToolbar className='static shrink-0 overflow-visible rounded-none px-3'>
            <FixedToolbarButtons />
          </FixedToolbar>
          <div className='min-h-0 flex-1 overflow-y-auto'>
            {header}
            <EditorContainer
              data-testid='sd-kb-editor'
              className='h-auto overflow-visible'
            >
              <Editor
                className='pt-2 pb-40 sm:px-[max(64px,calc(50%-450px))]'
                placeholder='Digite / para inserir blocos…'
              />
            </EditorContainer>
          </div>
        </div>
      </Plate>
    </EditorDocumentProvider>
  )
}
