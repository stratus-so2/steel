'use client'

import type { Value } from 'platejs'
import { Plate, usePlateEditor } from 'platejs/react'
import { Editor, EditorContainer } from '@/components/editor/ui/editor'
import { cn } from '@/lib/utils'
import { KB_VIEWER_PLUGINS } from './kb-plugins'

/** Renderização somente leitura do conteúdo Plate de um artigo da KB. */
export function KbRichViewer({
  content,
  className,
}: {
  content: Value
  className?: string
}) {
  const editor = usePlateEditor({ plugins: KB_VIEWER_PLUGINS, value: content })

  return (
    <Plate editor={editor} readOnly>
      <EditorContainer
        data-testid='sd-kb-viewer'
        className={cn('h-auto overflow-visible', className)}
      >
        <Editor variant='none' className='text-base' readOnly />
      </EditorContainer>
    </Plate>
  )
}
