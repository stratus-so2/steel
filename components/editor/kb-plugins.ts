'use client'

import { AlignKit } from './plugins/align-kit'
import { BasicNodesKit } from './plugins/basic-nodes-kit'
import { BlockMenuKit } from './plugins/block-menu-kit'
import { CodeBlockKit } from './plugins/code-block-kit'
import { CodeDrawingKit } from './plugins/code-drawing-kit'
import { ColumnKit } from './plugins/column-kit'
import { CommentKit } from './plugins/comment-kit'
import { DateKit } from './plugins/date-kit'
import { DiscussionKit } from './plugins/discussion-kit'
import { DndKit } from './plugins/dnd-kit'
import { DocxKit } from './plugins/docx-kit'
import { EmojiKit } from './plugins/emoji-kit'
import { FixedToolbarKit } from './plugins/fixed-toolbar-kit'
import { FloatingToolbarKit } from './plugins/floating-toolbar-kit'
import { FontKit } from './plugins/font-kit'
import { FootnoteKit } from './plugins/footnote-kit'
import { LineHeightKit } from './plugins/line-height-kit'
import { LinkKit } from './plugins/link-kit'
import { ListKit } from './plugins/list-kit'
import { MarkdownKit } from './plugins/markdown-kit'
import { MathKit } from './plugins/math-kit'
import { MediaKit } from './plugins/media-kit'
import { MentionKit } from './plugins/mention-kit'
import { SlashKit } from './plugins/slash-kit'
import { TableKit } from './plugins/table-kit'
import { TocKit } from './plugins/toc-kit'
import { ToggleKit } from './plugins/toggle-kit'

/** Nós renderizados tanto no editor quanto na leitura. */
const CONTENT_KITS = [
  ...BasicNodesKit,
  ...ListKit,
  ...CodeBlockKit,
  ...ColumnKit,
  ...ToggleKit,
  ...TocKit,
  ...MediaKit,
  ...LinkKit,
  ...DateKit,
  ...MathKit,
  ...EmojiKit,
  ...MentionKit,
  ...TableKit,
  ...CodeDrawingKit,
  ...FootnoteKit,
  ...AlignKit,
  ...FontKit,
  ...LineHeightKit,
]

/** Editor completo (mesma composição da Wiki do Nexo, sem Yjs/Excalidraw). */
export const KB_EDITOR_PLUGINS = [
  ...CONTENT_KITS,
  ...SlashKit,
  ...MarkdownKit,
  ...DocxKit,
  ...CommentKit,
  ...DiscussionKit,
  ...BlockMenuKit,
  ...DndKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
]

/**
 * Leitura (portal e visualização): só os nós. Sem barras, slash, arrastar e
 * sem comentários — as discussões são internas dos agentes.
 */
export const KB_VIEWER_PLUGINS = [...CONTENT_KITS, ...MarkdownKit]
