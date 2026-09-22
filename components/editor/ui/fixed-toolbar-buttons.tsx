'use client'

import { Baseline, Bold, Code2, Italic, PaintBucket, Strikethrough, Underline } from 'lucide-react'
import { KEYS } from 'platejs'
import { AlignToolbarButton } from '@/components/editor/ui/align-toolbar-button'
import { FontColorToolbarButton } from '@/components/editor/ui/font-color-toolbar-button'
import { FontSizeToolbarButton } from '@/components/editor/ui/font-size-toolbar-button'
import { RedoToolbarButton, UndoToolbarButton } from '@/components/editor/ui/history-toolbar-button'
import { IndentToolbarButton, OutdentToolbarButton } from '@/components/editor/ui/indent-toolbar-button'
import { LineHeightToolbarButton } from '@/components/editor/ui/line-height-toolbar-button'
import { BulletedListToolbarButton, NumberedListToolbarButton, TodoListToolbarButton, ToggleToolbarButton } from '@/components/editor/ui/list-toolbar-button'
import { MarkToolbarButton } from '@/components/editor/ui/mark-toolbar-button'
import { ToolbarGroup } from '@/components/editor/ui/toolbar'
import { TurnIntoToolbarButton } from '@/components/editor/ui/turn-into-toolbar-button'
import { InsertToolbarButton } from '@/components/editor/ui/insert-toolbar-button'
import { MediaToolbarButton } from '@/components/editor/ui/media-toolbar-button'
import { LinkToolbarButton } from '@/components/editor/ui/link-toolbar-button'
import { TableToolbarButton } from '@/components/editor/ui/table-toolbar-button'
import { EmojiToolbarButton } from '@/components/editor/ui/emoji-toolbar-button'
import { ExtraToolbarButton } from '@/components/editor/ui/extra-toolbar-button'
import { ExportToolbarButton } from '@/components/editor/ui/export-toolbar-button'
import { ImportToolbarButton } from '@/components/editor/ui/import-toolbar-button'

export function FixedToolbarButtons() {
  return (
    <div className='flex w-full items-center gap-1 overflow-x-auto'>
      <ToolbarGroup>
        <UndoToolbarButton />
        <RedoToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <ExportToolbarButton />
        <ImportToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <InsertToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <TurnIntoToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <FontSizeToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <MarkToolbarButton nodeType='bold' tooltip='Negrito' command='cmd+B'>
          <Bold />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='italic' tooltip='Itálico' command='cmd+I'>
          <Italic />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='underline' tooltip='Sublinhado' command='cmd+U'>
          <Underline />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='strikethrough' tooltip='Riscado' command='cmd+S'>
          <Strikethrough />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType='code' tooltip='Código' command='cmd+E'>
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
        <AlignToolbarButton />
        <NumberedListToolbarButton />
        <BulletedListToolbarButton />
        <TodoListToolbarButton />
        <ToggleToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <LinkToolbarButton />
        <TableToolbarButton />
        <EmojiToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <MediaToolbarButton nodeType={KEYS.img} />
        <MediaToolbarButton nodeType={KEYS.video} />
        <MediaToolbarButton nodeType={KEYS.audio} />
        <MediaToolbarButton nodeType={KEYS.file} />
      </ToolbarGroup>

      <ToolbarGroup>
        <LineHeightToolbarButton />
        <OutdentToolbarButton />
        <IndentToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <ExtraToolbarButton />
      </ToolbarGroup>
    </div>
  )
}
