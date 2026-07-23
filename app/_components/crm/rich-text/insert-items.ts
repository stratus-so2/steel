import {
  ArrowRight01Icon,
  FunctionIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  Heading04Icon,
  Heading05Icon,
  Heading06Icon,
  Image01Icon,
  LayoutGridIcon,
  LayoutThreeColumnIcon,
  LayoutTwoColumnIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MathIcon,
  MinusSignIcon,
  MusicNote01Icon,
  ParagraphIcon,
  QuoteDownIcon,
  SmileIcon,
  SourceCodeIcon,
  Table01Icon,
  TaskDone01Icon,
  Video01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Editor } from '@tiptap/core'

type IconType = typeof ParagraphIcon

export type InsertItem = {
  key: string
  title: string
  icon: IconType
  /** Termos extra para a busca do menu de barra ("/"). */
  keywords?: string
  action: (editor: Editor) => void
}

/** Pede uma URL e insere a mídia correspondente (sem upload de arquivo). */
function promptMedia(editor: Editor, kind: 'image' | 'video' | 'audio') {
  const label =
    kind === 'image' ? 'da imagem' : kind === 'video' ? 'do vídeo' : 'do áudio'
  const url = window.prompt(`Cole a URL ${label}`)?.trim()
  if (!url) return
  if (kind === 'image') {
    editor.chain().focus().setImage({ src: url }).run()
  } else {
    editor
      .chain()
      .focus()
      .insertContent({ type: kind, attrs: { src: url } })
      .run()
  }
}

/** Blocos disponíveis no menu de inserção e no menu de barra ("/"). */
export const BLOCK_ITEMS: InsertItem[] = [
  {
    key: 'paragraph',
    title: 'Parágrafo',
    icon: ParagraphIcon,
    keywords: 'text texto',
    action: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    key: 'h1',
    title: 'Título 1',
    icon: Heading01Icon,
    keywords: 'h1 heading titulo',
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: 'h2',
    title: 'Título 2',
    icon: Heading02Icon,
    keywords: 'h2 heading titulo',
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'h3',
    title: 'Título 3',
    icon: Heading03Icon,
    keywords: 'h3 heading titulo',
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    key: 'h4',
    title: 'Título 4',
    icon: Heading04Icon,
    keywords: 'h4 heading titulo',
    action: (e) => e.chain().focus().toggleHeading({ level: 4 }).run(),
  },
  {
    key: 'h5',
    title: 'Título 5',
    icon: Heading05Icon,
    keywords: 'h5 heading titulo',
    action: (e) => e.chain().focus().toggleHeading({ level: 5 }).run(),
  },
  {
    key: 'h6',
    title: 'Título 6',
    icon: Heading06Icon,
    keywords: 'h6 heading titulo',
    action: (e) => e.chain().focus().toggleHeading({ level: 6 }).run(),
  },
  {
    key: 'quote',
    title: 'Citação',
    icon: QuoteDownIcon,
    keywords: 'quote blockquote citacao',
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: 'toggle',
    title: 'Lista expansível',
    icon: ArrowRight01Icon,
    keywords: 'toggle details expansivel recolher',
    action: (e) => e.chain().focus().setDetails().run(),
  },
  {
    key: 'numbered',
    title: 'Lista numerada',
    icon: LeftToRightListNumberIcon,
    keywords: 'numbered ordered lista numerada',
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: 'bullet',
    title: 'Lista com marcadores',
    icon: LeftToRightListBulletIcon,
    keywords: 'bullet lista marcadores',
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'check',
    title: 'Lista de tarefas',
    icon: TaskDone01Icon,
    keywords: 'check task tarefas checkbox',
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    key: 'code',
    title: 'Bloco de código',
    icon: SourceCodeIcon,
    keywords: 'code codigo bloco',
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    key: 'divider',
    title: 'Divisor',
    icon: MinusSignIcon,
    keywords: 'divider hr linha divisor',
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    key: 'table',
    title: 'Tabela',
    icon: Table01Icon,
    keywords: 'table tabela grade',
    action: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    key: 'image',
    title: 'Imagem',
    icon: Image01Icon,
    keywords: 'image imagem foto',
    action: (e) => promptMedia(e, 'image'),
  },
  {
    key: 'video',
    title: 'Vídeo',
    icon: Video01Icon,
    keywords: 'video filme',
    action: (e) => promptMedia(e, 'video'),
  },
  {
    key: 'audio',
    title: 'Áudio',
    icon: MusicNote01Icon,
    keywords: 'audio som musica',
    action: (e) => promptMedia(e, 'audio'),
  },
  {
    key: '2cols',
    title: '2 Colunas',
    icon: LayoutTwoColumnIcon,
    keywords: '2 colunas layout columns dois',
    action: (e) => e.chain().focus().insertColumns(2).run(),
  },
  {
    key: '3cols',
    title: '3 Colunas',
    icon: LayoutThreeColumnIcon,
    keywords: '3 colunas layout columns tres',
    action: (e) => e.chain().focus().insertColumns(3).run(),
  },
  {
    key: '4cols',
    title: '4 Colunas',
    icon: LayoutGridIcon,
    keywords: '4 colunas layout columns quatro grid',
    action: (e) => e.chain().focus().insertColumns(4).run(),
  },
  {
    key: 'block-equation',
    title: 'Equação em bloco',
    icon: MathIcon,
    keywords: 'equacao matematica latex formula bloco block math',
    action: (e) => {
      const latex = window.prompt('Fórmula LaTeX (ex: E = mc^2)')?.trim()
      if (latex) e.chain().focus().insertBlockMath({ latex }).run()
    },
  },
  {
    key: 'inline-equation',
    title: 'Equação inline',
    icon: FunctionIcon,
    keywords: 'equacao matematica latex formula inline math',
    action: (e) => {
      const latex = window.prompt('Fórmula LaTeX inline (ex: E = mc^2)')?.trim()
      if (latex) e.chain().focus().insertInlineMath({ latex }).run()
    },
  },
]

export const EMOJI_ICON = SmileIcon

/** Emojis frequentes da grade de emojis. */
export const EMOJIS = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '😂',
  '🙂',
  '😉',
  '😊',
  '😍',
  '😘',
  '😎',
  '🤩',
  '🤔',
  '🙃',
  '😴',
  '😇',
  '🥳',
  '😢',
  '😭',
  '😡',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '🔥',
  '✨',
  '🎉',
  '✅',
  '❌',
  '⭐',
  '❤️',
  '💡',
  '📌',
  '📎',
  '🚀',
  '⚡',
  '📝',
]

/** Item de emoji para o menu de barra ("/"): insere o primeiro emoji. */
export const EMOJI_SLASH_ITEM: InsertItem = {
  key: 'emoji',
  title: 'Emoji',
  icon: SmileIcon,
  keywords: 'emoji emoticon',
  action: (e) => e.chain().focus().insertContent('😀').run(),
}

/** Itens completos do menu de barra ("/"). */
export const SLASH_ITEMS: InsertItem[] = [...BLOCK_ITEMS, EMOJI_SLASH_ITEM]
