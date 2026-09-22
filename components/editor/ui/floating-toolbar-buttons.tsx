'use client'

import { Baseline, Bold, Code2, Italic, PaintBucket, Strikethrough, Underline } from 'lucide-react'
import { CommentToolbarButton } from '@/components/editor/ui/comment-toolbar-button'
import { FontColorToolbarButton } from '@/components/editor/ui/font-color-toolbar-button'
import { MarkToolbarButton } from '@/components/editor/ui/mark-toolbar-button'
import { ToolbarGroup } from '@/components/editor/ui/toolbar'
import { TurnIntoToolbarButton } from '@/components/editor/ui/turn-into-toolbar-button'

export function FloatingToolbarButtons() {
  return (
    <>
      <ToolbarGroup>
        <TurnIntoToolbarButton />
      </ToolbarGroup>
      <ToolbarGroup>
        <MarkToolbarButton nodeType='bold' tooltip='Negrito'>
          <Bold />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='italic' tooltip='Itálico'>
          <Italic />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='underline' tooltip='Sublinhado'>
          <Underline />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='strikethrough' tooltip='Riscado'>
          <Strikethrough />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='code' tooltip='Código'>
          <Code2 />
        </MarkToolbarButton>
        <FontColorToolbarButton nodeType='color' tooltip='Cor do texto'>
          <Baseline />
        </FontColorToolbarButton>
        <FontColorToolbarButton nodeType='backgroundColor' tooltip='Cor de fundo'>
          <PaintBucket />
        </FontColorToolbarButton>
      </ToolbarGroup>
      <ToolbarGroup>
        <CommentToolbarButton />
      </ToolbarGroup>
    </>
  )
}
