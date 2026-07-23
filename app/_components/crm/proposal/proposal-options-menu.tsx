'use client'

import {
  BookmarkAdd02Icon,
  Copy01Icon,
  DownloadIcon,
  FilePlusIcon,
  MoreVerticalIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Editor } from '@tiptap/react'
import * as React from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import { createCrmDocumentTemplate } from '@/src/hooks/use-crm-document-template'
import type { CrmDocumentTypeDTO } from '@/types/crm-proposal'

/* ────────────────────────────── types ─────────────────────────────── */

type ExportFormat = 'pdf' | 'markdown'
type ExportContent = 'everything' | 'no-images'
type PaperSize = 'A4' | 'A3' | 'A2' | 'Letter' | 'Legal' | 'Tabloid'

const PAPER_SIZES: PaperSize[] = [
  'A4',
  'A3',
  'A2',
  'Letter',
  'Legal',
  'Tabloid',
]

/* ─────────────────── HTML → Markdown converter ─────────────────────── */

function nodeToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''

  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const inner = () => Array.from(el.childNodes).map(nodeToMd).join('')

  switch (tag) {
    case 'h1':
      return `\n# ${inner()}\n`
    case 'h2':
      return `\n## ${inner()}\n`
    case 'h3':
      return `\n### ${inner()}\n`
    case 'h4':
      return `\n#### ${inner()}\n`
    case 'h5':
      return `\n##### ${inner()}\n`
    case 'h6':
      return `\n###### ${inner()}\n`
    case 'p':
      return `\n${inner()}\n`
    case 'br':
      return '  \n'
    case 'strong':
    case 'b':
      return `**${inner()}**`
    case 'em':
    case 'i':
      return `_${inner()}_`
    case 's':
      return `~~${inner()}~~`
    case 'code':
      return el.closest('pre') ? inner() : `\`${inner()}\``
    case 'pre':
      return `\n\`\`\`\n${inner()}\n\`\`\`\n`
    case 'blockquote':
      return `${inner()
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}\n`
    case 'hr':
      return '\n---\n'
    case 'a':
      return `[${inner()}](${el.getAttribute('href') ?? ''})`
    case 'img':
      return `![${el.getAttribute('alt') ?? ''}](${el.getAttribute('src') ?? ''})`
    case 'ul':
      return `\n${Array.from(el.children)
        .map((li) => `- ${nodeToMd(li).trim()}`)
        .join('\n')}\n`
    case 'ol':
      return `\n${Array.from(el.children)
        .map((li, i) => `${i + 1}. ${nodeToMd(li).trim()}`)
        .join('\n')}\n`
    case 'li':
      return `${inner()}\n`
    case 'table':
      return tableToMd(el)
    default:
      return inner()
  }
}

function tableToMd(table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return ''
  const toRow = (row: Element) =>
    `| ${Array.from(row.querySelectorAll('th,td'))
      .map((c) => c.textContent?.trim() ?? '')
      .join(' | ')} |`
  const [head, ...body] = rows
  const headerLine = toRow(head)
  const cols = head.querySelectorAll('th,td').length
  const sep = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`
  return ['\n', headerLine, sep, ...body.map(toRow), '\n'].join('\n')
}

function htmlToMarkdown(html: string): string {
  if (typeof window === 'undefined') return html
  const div = document.createElement('div')
  div.innerHTML = html
  return Array.from(div.childNodes)
    .map(nodeToMd)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripMedia(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  for (const el of div.querySelectorAll('img, video, audio, figure')) {
    el.remove()
  }
  return div.innerHTML
}

/* ──────────────────────── PDF print helper ──────────────────────────── */

const PAPER_CSS: Record<PaperSize, string> = {
  A4: '210mm 297mm',
  A3: '297mm 420mm',
  A2: '420mm 594mm',
  Letter: '8.5in 11in',
  Legal: '8.5in 14in',
  Tabloid: '11in 17in',
}

function printAsPdf(html: string, title: string, size: PaperSize) {
  const win = window.open('', '_blank')
  if (!win) {
    notify.error('Popup bloqueado. Permita popups para exportar em PDF.')
    return
  }
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page { size: ${PAPER_CSS[size]}; margin: 2cm; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; font-size: 11pt; line-height: 1.6; color: #111; margin: 0; }
    h1 { font-size: 22pt; font-weight: 700; margin: 0 0 0.5em; }
    h2 { font-size: 17pt; font-weight: 600; margin: 1em 0 0.4em; }
    h3 { font-size: 13pt; font-weight: 600; margin: 0.8em 0 0.3em; }
    h4, h5, h6 { font-size: 11pt; font-weight: 600; margin: 0.6em 0 0.2em; }
    p { margin: 0 0 0.5em; }
    ul, ol { padding-left: 1.25em; margin: 0 0 0.5em; }
    blockquote { border-left: 3px solid #ccc; padding-left: 0.75em; color: #555; margin: 0.5em 0; }
    pre { background: #f5f5f5; border-radius: 4px; padding: 0.75em 1em; font-size: 9pt; overflow-x: auto; }
    code { font-family: monospace; font-size: 9pt; background: #f0f0f0; padding: 0.1em 0.25em; border-radius: 3px; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
    th, td { border: 1px solid #ccc; padding: 0.35em 0.5em; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 600; }
    img { max-width: 100%; border-radius: 4px; }
    a { color: #2563eb; }
    hr { border: none; border-top: 1px solid #ddd; margin: 0.75em 0; }
    [data-type="columns"] { display: grid; gap: 0.75em; }
    [data-type="columns"][data-cols="2"] { grid-template-columns: repeat(2, 1fr); }
    [data-type="columns"][data-cols="3"] { grid-template-columns: repeat(3, 1fr); }
    [data-type="columns"][data-cols="4"] { grid-template-columns: repeat(4, 1fr); }
    [data-type="column"] { border: 1px dashed #ddd; border-radius: 4px; padding: 0.5em; }
  </style>
</head>
<body>${html}</body>
</html>`)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}

/* ─────────────────────── export modal ──────────────────────────────── */

function ExportModal({
  open,
  onClose,
  editor,
  title,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
  title: string
}) {
  const [format, setFormat] = React.useState<ExportFormat>('pdf')
  const [content, setContent] = React.useState<ExportContent>('everything')
  const [size, setSize] = React.useState<PaperSize>('A4')
  const [exporting, setExporting] = React.useState(false)

  const doExport = async () => {
    setExporting(true)
    try {
      let html = editor.getHTML()
      if (content === 'no-images') html = stripMedia(html)

      if (format === 'pdf') {
        printAsPdf(html, title, size)
        onClose()
        return
      }

      /* markdown download */
      const md = htmlToMarkdown(html)
      const blob = new Blob([md], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
      notify.success('Markdown exportado.')
      onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Exportar documento</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          {/* Format */}
          <div className='flex flex-col gap-1.5'>
            <span className='font-medium text-sm'>Formato</span>
            <div className='flex gap-2'>
              {(['pdf', 'markdown'] as const).map((f) => (
                <button
                  key={f}
                  type='button'
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    format === f
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border bg-transparent hover:bg-muted'
                  }`}
                >
                  {f === 'pdf' ? 'PDF' : 'Markdown'}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className='flex flex-col gap-1.5'>
            <span className='font-medium text-sm'>Conteúdo</span>
            <div className='flex gap-2'>
              {(['everything', 'no-images'] as const).map((c) => (
                <button
                  key={c}
                  type='button'
                  onClick={() => setContent(c)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    content === c
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border bg-transparent hover:bg-muted'
                  }`}
                >
                  {c === 'everything' ? 'Tudo' : 'Sem imagens'}
                </button>
              ))}
            </div>
          </div>

          {/* Paper size – PDF only */}
          {format === 'pdf' && (
            <div className='flex flex-col gap-1.5'>
              <span className='font-medium text-sm'>Tamanho do papel</span>
              <Select
                value={size}
                onValueChange={(v) => setSize(v as PaperSize)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={exporting}>
            Cancelar
          </Button>
          <Button onClick={doExport} disabled={exporting}>
            <SteelIcon icon={DownloadIcon} strokeWidth={2} />
            {exporting ? 'Exportando...' : 'Exportar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────── main component ────────────────────────────── */

export function ProposalOptionsMenu({
  editor,
  workspaceId,
  title,
  type,
}: {
  editor: Editor
  workspaceId: string
  title: string
  type: CrmDocumentTypeDTO
}) {
  const [exportOpen, setExportOpen] = React.useState(false)

  const saveAsTemplate = async () => {
    const created = await createCrmDocumentTemplate(workspaceId, {
      title,
      content: editor.getHTML(),
      type,
    })
    if (created) {
      notify.success('Template salvo. Disponível ao criar novos documentos.')
    } else {
      notify.error('Não foi possível salvar o template.')
    }
  }

  const copyMarkdown = async () => {
    try {
      const md = htmlToMarkdown(editor.getHTML())
      await navigator.clipboard.writeText(md)
      notify.success('Markdown copiado para a área de transferência.')
    } catch {
      notify.error('Não foi possível copiar.')
    }
  }

  const makeCopy = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/crm/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${title} (cópia)`,
          content: editor.getHTML(),
          type,
        }),
      })
      const json = (await res.json()) as { success: boolean; message?: string }
      if (!res.ok || !json.success) throw new Error(json.message)
      notify.success('Cópia criada com sucesso.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Erro ao criar cópia.')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton={true}
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label='Mais opções'
              className='text-muted-foreground hover:text-foreground'
            >
              <SteelIcon icon={MoreVerticalIcon} strokeWidth={2} />
            </Button>
          }
        />
        <DropdownMenuContent align='end' className='w-48'>
          <DropdownMenuItem onClick={copyMarkdown}>
            <SteelIcon
              icon={Copy01Icon}
              strokeWidth={2}
              className='size-4 shrink-0'
            />
            Copiar Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={makeCopy}>
            <SteelIcon
              icon={FilePlusIcon}
              strokeWidth={2}
              className='size-4 shrink-0'
            />
            Fazer uma cópia
          </DropdownMenuItem>
          <DropdownMenuItem onClick={saveAsTemplate}>
            <SteelIcon
              icon={BookmarkAdd02Icon}
              strokeWidth={2}
              className='size-4 shrink-0'
            />
            Salvar como template
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setExportOpen(true)}>
            <SteelIcon
              icon={DownloadIcon}
              strokeWidth={2}
              className='size-4 shrink-0'
            />
            Exportar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        editor={editor}
        title={title}
      />
    </>
  )
}
