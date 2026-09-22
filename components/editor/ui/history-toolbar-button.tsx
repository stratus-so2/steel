'use client'

import { useEditorRef, useEditorSelector } from "platejs/react"
import { ToolbarButton } from "@/components/editor/ui/toolbar"
import { Redo2, Undo2 } from "lucide-react"

function getUndoRedoLength(
  editor: { history: { undos: unknown[]; redos: unknown[] } },
  kind: 'undo' | 'redo'
): number {
  return kind === 'undo' ? editor.history.undos.length : editor.history.redos.length
}

export function RedoToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const editor = useEditorRef()
  const disabled = useEditorSelector(
    (editor) => getUndoRedoLength(editor, 'redo') === 0,
    []
  )

  return (
    <ToolbarButton
      {...props}
      disabled={disabled}
      onClick={() => editor.redo()}
      onMouseDown={(e) => e.preventDefault()}
      tooltip='Refazer'
    >
      <Redo2 />
    </ToolbarButton>
  )
}


export function UndoToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const editor = useEditorRef()
  const disabled = useEditorSelector(
    (editor) => getUndoRedoLength(editor, 'undo') === 0,
    []
  )

  return (
    <ToolbarButton
      {...props}
      disabled={disabled}
      onClick={() => editor.undo()}
      onMouseDown={(e) => e.preventDefault()}
      tooltip='Desfazer'
    >
      <Undo2 />
    </ToolbarButton>
  )
}
