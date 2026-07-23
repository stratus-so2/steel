'use client'

import {
  ArrowDown01Icon,
  CodeIcon,
  Delete01Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  Image01Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  MinusSignIcon,
  ParagraphIcon,
  QuoteDownIcon,
  SourceCodeIcon,
  Table01Icon,
  TaskDone01Icon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Editor } from '@tiptap/react'
import * as React from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type IconType = typeof ParagraphIcon

/** Re-renderiza quando a seleção/conteúdo muda, mantendo os estados ativos. */
function useEditorTick(editor: Editor) {
  const [, force] = React.useReducer((x) => x + 1, 0)
  React.useEffect(() => {
    const update = () => force()
    editor.on('transaction', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('transaction', update)
      editor.off('selectionUpdate', update)
    }
  }, [editor])
}

function ToolButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: IconType
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-muted-foreground hover:text-foreground',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      <SteelIcon icon={icon} strokeWidth={2} />
    </Button>
  )
}

const BLOCK_TYPES = [
  { key: 'paragraph', label: 'Parágrafo', icon: ParagraphIcon },
  { key: 'h1', label: 'Título 1', icon: Heading01Icon, level: 1 },
  { key: 'h2', label: 'Título 2', icon: Heading02Icon, level: 2 },
  { key: 'h3', label: 'Título 3', icon: Heading03Icon, level: 3 },
] as const

function currentBlock(editor: Editor) {
  if (editor.isActive('heading', { level: 1 })) return BLOCK_TYPES[1]
  if (editor.isActive('heading', { level: 2 })) return BLOCK_TYPES[2]
  if (editor.isActive('heading', { level: 3 })) return BLOCK_TYPES[3]
  return BLOCK_TYPES[0]
}

function promptLink(editor: Editor) {
  const prev = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('URL do link', prev ?? 'https://')
  if (url === null) return
  const chain = editor.chain().focus().extendMarkRange('link')
  if (url.trim() === '') chain.unsetLink().run()
  else chain.setLink({ href: url.trim() }).run()
}

function promptImage(editor: Editor) {
  const url = window.prompt('Cole a URL da imagem')?.trim()
  if (url) editor.chain().focus().setImage({ src: url }).run()
}

/** Dropdown contextual com operações de linha/coluna — aparece dentro de tabelas. */
function TableMenu({ editor }: { editor: Editor }) {
  if (!editor.isActive('table')) return null

  const cmd = () => editor.chain().focus()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton={true}
        render={
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='gap-1.5 bg-accent text-accent-foreground'
          >
            <SteelIcon icon={Table01Icon} strokeWidth={2} />
            <span>Tabela</span>
            <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
          </Button>
        }
      />
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Linhas</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => cmd().addRowBefore().run()}>
            Inserir linha acima
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd().addRowAfter().run()}>
            Inserir linha abaixo
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => cmd().deleteRow().run()}
            className='text-destructive focus:text-destructive'
          >
            <SteelIcon icon={Delete01Icon} strokeWidth={2} />
            Excluir linha
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Colunas</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => cmd().addColumnBefore().run()}>
            Inserir coluna à esquerda
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd().addColumnAfter().run()}>
            Inserir coluna à direita
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => cmd().deleteColumn().run()}
            className='text-destructive focus:text-destructive'
          >
            <SteelIcon icon={Delete01Icon} strokeWidth={2} />
            Excluir coluna
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => cmd().deleteTable().run()}
            className='text-destructive focus:text-destructive'
          >
            <SteelIcon icon={Delete01Icon} strokeWidth={2} />
            Excluir tabela
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Menu superior com as opções do TipTap organizadas em grupos. */
export function ProposalToolbar({ editor }: { editor: Editor }) {
  useEditorTick(editor)
  const block = currentBlock(editor)

  return (
    <div className='flex flex-wrap items-center gap-0.5'>
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton={true}
          render={
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='gap-1.5 text-muted-foreground hover:text-foreground'
            >
              <SteelIcon icon={block.icon} strokeWidth={2} />
              <span className='min-w-16 text-left'>{block.label}</span>
              <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
            </Button>
          }
        />
        <DropdownMenuContent align='start' className='w-44'>
          {BLOCK_TYPES.map((b) => (
            <DropdownMenuItem
              key={b.key}
              onClick={() => {
                const chain = editor.chain().focus()
                if ('level' in b) chain.setHeading({ level: b.level }).run()
                else chain.setParagraph().run()
              }}
            >
              <SteelIcon icon={b.icon} strokeWidth={2} />
              <span className='flex-1'>{b.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation='vertical' className='mx-1 h-5' />

      <ToolButton
        icon={TextBoldIcon}
        label='Negrito'
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={TextItalicIcon}
        label='Itálico'
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={TextUnderlineIcon}
        label='Sublinhado'
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        icon={TextStrikethroughIcon}
        label='Tachado'
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolButton
        icon={CodeIcon}
        label='Código'
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolButton
        icon={Link01Icon}
        label='Link'
        active={editor.isActive('link')}
        onClick={() => promptLink(editor)}
      />

      <Separator orientation='vertical' className='mx-1 h-5' />

      <ToolButton
        icon={TextAlignLeftIcon}
        label='Alinhar à esquerda'
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      />
      <ToolButton
        icon={TextAlignCenterIcon}
        label='Centralizar'
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      />
      <ToolButton
        icon={TextAlignRightIcon}
        label='Alinhar à direita'
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      />

      <Separator orientation='vertical' className='mx-1 h-5' />

      <ToolButton
        icon={LeftToRightListBulletIcon}
        label='Lista com marcadores'
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={LeftToRightListNumberIcon}
        label='Lista numerada'
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        icon={TaskDone01Icon}
        label='Lista de tarefas'
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />

      <Separator orientation='vertical' className='mx-1 h-5' />

      <ToolButton
        icon={QuoteDownIcon}
        label='Citação'
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        icon={SourceCodeIcon}
        label='Bloco de código'
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolButton
        icon={MinusSignIcon}
        label='Linha divisória'
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <Separator orientation='vertical' className='mx-1 h-5' />

      <ToolButton
        icon={Table01Icon}
        label='Inserir tabela'
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      />
      <TableMenu editor={editor} />
      <ToolButton
        icon={Image01Icon}
        label='Inserir imagem'
        onClick={() => promptImage(editor)}
      />
    </div>
  )
}
