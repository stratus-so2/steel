'use client'

import { KEYS, type Value } from 'platejs'
import { Plate, usePlateEditor } from 'platejs/react'
import { Editor, EditorContainer } from '@/components/editor/ui/editor'
import { cn } from '@/lib/utils'
import { KbEditorProvider } from '@/src/hooks/use-sd-kb-editor-context'
import { KB_EDITOR_PLUGINS } from './kb-plugins'

/**
 * Editor da base de conhecimento do ServiceDesk — port do `WikiPageRichEditor`
 * do Nexo (mesmos kits: blocos, listas, código, colunas, toggle, sumário,
 * mídia, link, data, equação, emoji, menção, slash, tabela, diagramas de
 * código, notas de rodapé, markdown/docx, comentários/discussões, alinhamento,
 * fonte, altura de linha, menu de bloco, arrastar e soltar e as barras fixa e
 * flutuante). Diferenças: sem Yjs/Hocuspocus (o autosave é o JSON do
 * conteúdo, como o `content` da Wiki) e sem o bloco Excalidraw.
 */

interface KbRichEditorProps {
  workspaceId: string
  articleId: string
  userId: string
  userName: string
  content: Value
  onChange: (content: Value) => void
  className?: string
}

export function KbRichEditor({
  workspaceId,
  articleId,
  userId,
  userName,
  content,
  onChange,
  className,
}: KbRichEditorProps) {
  const editor = usePlateEditor({
    plugins: KB_EDITOR_PLUGINS,
    value: content,
  })

  return (
    <KbEditorProvider
      workspaceId={workspaceId}
      articleId={articleId}
      userId={userId}
      userName={userName}
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
        <div className={cn('flex h-full flex-col no-scrollbar', className)}>
          <EditorContainer
            data-testid='sd-kb-editor'
            className='min-h-0 flex-1 no-scrollbar'
          >
            <Editor
              variant='fullWidth'
              className='px-0 pt-2 pb-40 sm:px-0'
              placeholder='Digite / para inserir blocos…'
            />
          </EditorContainer>
        </div>
      </Plate>
    </KbEditorProvider>
  )
}
