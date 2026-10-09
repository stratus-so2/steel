'use client'

import {
  BookOpen01Icon,
  PanelLeftIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import type { Value } from 'platejs'
import { Fragment, useEffect, useRef, useState } from 'react'
import {
  useShortcut,
  useShortcuts,
} from '@/app/_components/shortcuts/shortcuts-provider'
import {
  WikiPageRichEditor,
  type WikiSyncStatus,
} from '@/components/editor/wiki-editor'
import { SteelIcon } from '@/components/icon/icon'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUpdateWikiPage, useWikiPages } from '@/src/hooks/use-wiki-page'
import { wikiAncestors } from '@/src/lib/wiki-tree'
import type { WikiPageDTO } from '@/types/wiki-page'
import { WikiPageLabels } from './wiki-page-labels'

// The real content is already synced in real time via Yjs/Hocuspocus —
// this autosave only keeps WikiPage.content (the flat JSON snapshot, used
// for listing/search outside the Yjs doc) up to date. Since nothing depends
// on it to avoid losing keystrokes, a larger debounce here only reduces
// write frequency with no real risk of data loss.
const AUTOSAVE_DELAY_MS = 1500 // ms

const STATUS_COPY: Record<WikiSyncStatus, { label: string; hint: string }> = {
  connecting: {
    label: 'Conectando…',
    hint: 'Abrindo a edição em tempo real',
  },
  synced: {
    label: 'Sincronizado',
    hint: 'Quem estiver nesta página vê suas alterações na hora',
  },
  offline: {
    label: 'Sem conexão',
    hint: 'As alterações voltam a sincronizar quando a conexão voltar',
  },
}

interface WikiPageEditorProps {
  workspaceId: string
  workspaceSlug: string
  userId: string
  userName: string
  page: WikiPageDTO
}

export function WikiPageEditor({
  workspaceId,
  workspaceSlug,
  userId,
  userName,
  page,
}: WikiPageEditorProps) {
  const updateWikiPage = useUpdateWikiPage(workspaceId, page.id)
  const pages = useWikiPages(workspaceId)
  const shortcuts = useShortcuts()
  const [title, setTitle] = useState(page.title)
  const [status, setStatus] = useState<WikiSyncStatus>('connecting')
  const contentRef = useRef<Value>(page.content)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `E`: put the cursor in the page body.
  useShortcut('wiki.focus-editor', () => {
    const editor = document.querySelector<HTMLElement>('[data-slate-editor]')
    if (!editor) return false
    editor.focus()
  })

  useEffect(() => {
    setTitle(page.title)
    contentRef.current = page.content
  }, [page.id, page.title, page.content])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  function scheduleContentSave(content: Value) {
    contentRef.current = content
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      updateWikiPage.mutate({ content: contentRef.current })
    }, AUTOSAVE_DELAY_MS)
  }

  const ancestors = wikiAncestors(pages.data ?? [], page.id)
  const statusCopy = STATUS_COPY[status]

  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <div className='flex h-11 shrink-0 items-center justify-between gap-2 border-b border-secondary px-3 md:px-5'>
        <div className='flex min-w-0 items-center gap-1'>
          <Button
            variant='ghost'
            size='icon-sm'
            className='max-md:hidden'
            aria-label='Mostrar ou ocultar as páginas'
            title='Mostrar ou ocultar as páginas ( [ )'
            onClick={() => shortcuts?.trigger('nav.toggle-sidebar')}
          >
            <SteelIcon icon={PanelLeftIcon} strokeWidth={2} />
          </Button>
          <Breadcrumb className='min-w-0'>
            <BreadcrumbList className='flex-nowrap text-xs'>
              <BreadcrumbItem className='shrink-0'>
                <Link
                  href={`/${workspaceSlug}/wiki`}
                  className='inline-flex items-center gap-1.5 font-semibold hover:text-foreground'
                >
                  <SteelIcon icon={BookOpen01Icon} strokeWidth={2} />
                  Wiki
                </Link>
              </BreadcrumbItem>
              {ancestors.map((ancestor) => (
                <Fragment key={ancestor.id}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className='min-w-0 max-sm:hidden'>
                    <Link
                      href={`/${workspaceSlug}/wiki/${ancestor.id}`}
                      className='truncate hover:text-foreground'
                    >
                      {ancestor.title || 'Sem título'}
                    </Link>
                  </BreadcrumbItem>
                </Fragment>
              ))}
              <BreadcrumbSeparator />
              <BreadcrumbItem className='min-w-0'>
                <BreadcrumbPage className='truncate font-medium'>
                  {title || 'Sem título'}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <output
          aria-live='polite'
          data-status={status}
          title={statusCopy.hint}
          className='flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs'
        >
          <span
            aria-hidden
            className={cn(
              'size-2 rounded-full',
              status === 'synced' && 'bg-primary',
              status === 'connecting' && 'animate-pulse bg-muted-foreground',
              status === 'offline' && 'bg-destructive',
            )}
          />
          <span className='max-sm:sr-only'>{statusCopy.label}</span>
        </output>
      </div>

      {/* One scroller for the whole page: the title and labels scroll away
          and the editor toolbar sticks to the top. */}
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <WikiPageRichEditor
          key={page.id}
          documentName={page.id}
          workspaceId={workspaceId}
          userId={userId}
          userName={userName}
          content={page.content}
          onChange={scheduleContentSave}
          onStatusChange={setStatus}
          header={
            <header className='space-y-2 px-5 pt-6 pb-3 sm:px-[max(64px,calc(50%-350px))] sm:pt-10'>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (title !== page.title) updateWikiPage.mutate({ title })
                }}
                placeholder='Sem título'
                aria-label='Título da página'
                className='w-full bg-transparent font-semibold text-2xl tracking-tight outline-none placeholder:text-muted-foreground/60 sm:text-3xl'
              />
              <WikiPageLabels
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                wikiPageId={page.id}
                initialLabelIds={page.labelIds}
              />
            </header>
          }
        />
      </div>
    </div>
  )
}
