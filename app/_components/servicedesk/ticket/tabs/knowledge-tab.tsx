'use client'

import {
  BookOpen01Icon,
  Link01Icon,
  Search01Icon,
  SparklesIcon,
  Unlink01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SdKbArticleView } from '@/app/_components/servicedesk/knowledge'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import {
  useLinkSdKbArticle,
  useSdKbSearch,
  useSdKbSuggestions,
  useSdTicketKbLinks,
  useUnlinkSdKbArticle,
} from '@/src/hooks/use-sd-knowledge'
import type { SdKbArticleSummaryDTO } from '@/types/sd-kb-article'
import { useDebouncedValue } from '../../table/use-sd-table-state'
import type { SdTicketTabProps } from './types'

function ArticleRow({
  article,
  excerpt,
  linked,
  busy,
  canEdit,
  onOpen,
  onLink,
  onUnlink,
}: {
  article: SdKbArticleSummaryDTO
  excerpt?: string
  linked: boolean
  busy: boolean
  canEdit: boolean
  onOpen: () => void
  onLink: () => void
  onUnlink: () => void
}) {
  return (
    <li className='flex items-start gap-3 border-b px-3 py-2.5 last:border-b-0'>
      <span className='mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm'>
        {article.icon ?? (
          <SteelIcon icon={BookOpen01Icon} strokeWidth={2} className='size-4' />
        )}
      </span>
      <button
        type='button'
        onClick={onOpen}
        className='flex min-w-0 flex-1 flex-col text-left'
      >
        <span className='truncate font-medium text-sm hover:underline'>
          {article.title}
        </span>
        {excerpt ? (
          <span className='line-clamp-2 text-muted-foreground text-xs'>
            {excerpt}
          </span>
        ) : article.tags.length ? (
          <span className='truncate text-muted-foreground text-xs'>
            {article.tags.map((t) => `#${t}`).join(' ')}
          </span>
        ) : null}
      </button>
      {canEdit ? (
        linked ? (
          <Button
            variant='ghost'
            size='xs'
            disabled={busy}
            onClick={onUnlink}
            aria-label={`Desvincular ${article.title}`}
          >
            <SteelIcon icon={Unlink01Icon} strokeWidth={2} />
            Desvincular
          </Button>
        ) : (
          <Button
            variant='outline'
            size='xs'
            disabled={busy}
            onClick={onLink}
            aria-label={`Vincular ${article.title}`}
          >
            <SteelIcon icon={Link01Icon} strokeWidth={2} />
            Vincular
          </Button>
        )
      ) : null}
    </li>
  )
}

/**
 * Conhecimento: artigos vinculados ao chamado, sugestões pelo conteúdo do
 * chamado e busca na base para vincular/desvincular; o artigo abre num
 * painel lateral (`SdKbArticleView`).
 */
export function SdTicketKnowledgeTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const q = useDebouncedValue(search.trim())
  const links = useSdTicketKbLinks(workspaceId, ticket.id)
  const suggestions = useSdKbSuggestions(workspaceId, ticket.id)
  const results = useSdKbSearch(
    workspaceId,
    { q, status: 'PUBLISHED', limit: 10 },
    q.length >= 2,
  )
  const link = useLinkSdKbArticle(workspaceId, ticket.id)
  const unlink = useUnlinkSdKbArticle(workspaceId, ticket.id)
  const linkedIds = new Set((links.data ?? []).map((l) => l.article.id))
  const busy = link.isPending || unlink.isPending
  const canEdit = mode === 'agent'

  const row = (article: SdKbArticleSummaryDTO, excerpt?: string) => (
    <ArticleRow
      key={article.id}
      article={article}
      excerpt={excerpt}
      linked={linkedIds.has(article.id)}
      busy={busy}
      canEdit={canEdit}
      onOpen={() => setOpen(article.id)}
      onLink={() =>
        link.mutate(article.id, {
          onSuccess: () => notify.success('Artigo vinculado.'),
          onError: notify.error,
        })
      }
      onUnlink={() =>
        unlink.mutate(article.id, {
          onSuccess: () => notify.success('Artigo desvinculado.'),
          onError: notify.error,
        })
      }
    />
  )

  const suggested = (suggestions.data ?? []).filter((s) => !linkedIds.has(s.id))

  return (
    <div className='grid gap-6 p-4 lg:grid-cols-2'>
      <section className='flex flex-col gap-3'>
        <h3 className='font-semibold text-sm'>
          Artigos vinculados
          {links.data?.length ? (
            <span className='ml-1.5 text-muted-foreground text-xs'>
              {links.data.length}
            </span>
          ) : null}
        </h3>
        {links.isLoading ? (
          <Skeleton className='h-16 w-full' />
        ) : links.data?.length ? (
          <ul className='overflow-hidden rounded-xl border'>
            {links.data.map((l) => row(l.article))}
          </ul>
        ) : (
          <p className='rounded-lg border border-dashed py-6 text-center text-muted-foreground text-sm'>
            Nenhum artigo vinculado.
          </p>
        )}

        <h3 className='mt-2 flex items-center gap-1.5 font-semibold text-sm'>
          <SteelIcon
            icon={SparklesIcon}
            strokeWidth={2}
            className='size-4 text-amber-500'
          />
          Sugestões para este chamado
        </h3>
        {suggestions.isLoading ? (
          <Skeleton className='h-16 w-full' />
        ) : suggested.length ? (
          <ul className='overflow-hidden rounded-xl border'>
            {suggested.map((s) => row(s, s.excerpt))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-xs'>
            Sem sugestões pelo título e descrição.
          </p>
        )}
      </section>

      <section className='flex flex-col gap-3'>
        <h3 className='font-semibold text-sm'>Buscar na base</h3>
        <div className='relative'>
          <SteelIcon
            icon={Search01Icon}
            strokeWidth={2}
            className='-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground'
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar artigos publicados…'
            aria-label='Buscar artigos'
            className='pl-8'
          />
        </div>
        {q.length < 2 ? (
          <p className='text-muted-foreground text-xs'>
            Digite ao menos 2 letras.
          </p>
        ) : results.isLoading ? (
          <Skeleton className='h-16 w-full' />
        ) : results.data?.length ? (
          <ul className='overflow-hidden rounded-xl border'>
            {results.data.map((r) => row(r, r.excerpt))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-xs'>
            Nenhum artigo encontrado.
          </p>
        )}
      </section>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className='w-full overflow-y-auto sm:max-w-3xl'>
          <SheetHeader className='sr-only'>
            <SheetTitle>Artigo da base de conhecimento</SheetTitle>
          </SheetHeader>
          {open ? (
            <SdKbArticleView
              workspaceId={workspaceId}
              articleId={open}
              showStatus={mode === 'agent'}
              onSelectRelated={(a) => setOpen(a.id)}
              className='p-4'
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
