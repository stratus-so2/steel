import {
  Details,
  DetailsContent,
  DetailsSummary,
} from '@tiptap/extension-details'
import { Image } from '@tiptap/extension-image'
import { Mathematics } from '@tiptap/extension-mathematics'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { TextAlign } from '@tiptap/extension-text-align'
import type { Extensions } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Audio,
  Column,
  Columns,
  Video,
} from '@/app/_components/crm/rich-text/nodes'
import { SlashCommand } from '@/app/_components/crm/rich-text/slash-command'

/**
 * Nodes/marks comuns a todo render de rich text (editor + viewer read-only).
 * Sem o menu de barra "/" — esse só faz sentido na edição.
 */
const BASE_EXTENSIONS: Extensions = [
  StarterKit,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Details.configure({ persist: true }),
  DetailsSummary,
  DetailsContent,
  TableKit,
  Image,
  Video,
  Audio,
  Column,
  Columns,
  Mathematics.configure({ katexOptions: { throwOnError: false } }),
]

/** Extensões do editor (inclui o comando "/" e placeholder). */
export const RICH_TEXT_EXTENSIONS: Extensions = [
  ...BASE_EXTENSIONS,
  SlashCommand,
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === 'heading') return 'Cabeçalho...'
      return "Digite '/' para inserir um bloco..."
    },
    showOnlyWhenEditable: true,
  }),
]

/** Extensões para render read-only (página pública) — sem o menu "/". */
export const READONLY_RICH_TEXT_EXTENSIONS: Extensions = BASE_EXTENSIONS
