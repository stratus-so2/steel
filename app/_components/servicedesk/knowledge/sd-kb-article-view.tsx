'use client'

import { useEffect, useRef } from 'react'
import { KbRichViewer } from '@/components/editor/kb-viewer'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useRecordSdKbView,
  useSdKbArticle,
  useSdKbRelated,
} from '@/src/hooks/use-sd-knowledge'
import type {
  SdKbArticleDTO,
  SdKbArticleSummaryDTO,
} from '@/types/sd-kb-article'
import { SdKbArticleList } from './sd-kb-article-list'
import { SdKbArticleMeta } from './sd-kb-article-meta'
import { SdKbStatusBadge, SdKbVisibilityBadge } from './sd-kb-status-badge'
import { SdKbToc } from './sd-kb-toc'
import { SdKbVote } from './sd-kb-vote'

export interface SdKbArticleViewProps {
  workspaceId: string
  /** Artigo já carregado (SSR); sem ele, busca por `articleId`. */
  article?: SdKbArticleDTO
  articleId?: string
  /** Mostra status/visibilidade (agentes). Portal: `false`. */
  showStatus?: boolean
  /** Conta a visualização ao abrir (padrão `true`). */
  recordView?: boolean
  /** Portal: abre o relacionado sem navegar. */
  onSelectRelated?: (article: SdKbArticleSummaryDTO) => void
  /** Links dos relacionados (telas internas). */
  hrefForRelated?: (article: SdKbArticleSummaryDTO) => string
  className?: string
}

/**
 * Leitura de um artigo da KB (somente leitura): capa, ícone, título, meta,
 * conteúdo Plate, sumário, "Este artigo ajudou?" e relacionados. Exportado
 * para o portal do solicitante e para a aba "Conhecimento" do chamado.
 */
export function SdKbArticleView({
  workspaceId,
  article: initial,
  articleId,
  showStatus = false,
  recordView = true,
  onSelectRelated,
  hrefForRelated,
  className,
}: SdKbArticleViewProps) {
  const id = initial?.id ?? articleId ?? ''
  const { data: article, isLoading } = useSdKbArticle(workspaceId, id, initial)
  const related = useSdKbRelated(workspaceId, id)
  const view = useRecordSdKbView(workspaceId)
  const viewed = useRef<string | null>(null)

  useEffect(() => {
    if (!recordView || !id || viewed.current === id) return
    viewed.current = id
    view.mutate(id)
  }, [id, recordView])

  if (isLoading || !article) {
    return (
      <div
        className={cn('space-y-3 p-6', className)}
        data-testid='sd-kb-view-loading'
      >
        <Skeleton className='h-8 w-2/3' />
        <Skeleton className='h-4 w-1/3' />
        <Skeleton className='h-40 w-full' />
      </div>
    )
  }

  const containerId = `sd-kb-view-${article.id}`

  return (
    <article className={cn('mx-auto w-full max-w-5xl', className)}>
      {article.coverImage && (
        <img
          src={article.coverImage}
          alt=''
          className='h-44 w-full rounded-b-lg object-cover'
        />
      )}
      <div className='grid gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_220px]'>
        <div className='min-w-0 space-y-5'>
          <header className='space-y-3'>
            {article.icon && <div className='text-4xl'>{article.icon}</div>}
            <h1 className='font-semibold text-3xl tracking-tight'>
              {article.title || 'Sem título'}
            </h1>
            {showStatus && (
              <div className='flex gap-2'>
                <SdKbStatusBadge status={article.status} />
                <SdKbVisibilityBadge visibility={article.visibility} />
              </div>
            )}
            <SdKbArticleMeta article={article} showViews={showStatus} />
          </header>

          <div id={containerId}>
            <KbRichViewer key={article.id} content={article.content} />
          </div>

          <SdKbVote
            workspaceId={workspaceId}
            articleId={article.id}
            helpfulCount={article.helpfulCount}
            notHelpfulCount={article.notHelpfulCount}
            myVote={article.myVote}
          />

          {(related.data?.length ?? 0) > 0 && (
            <section className='space-y-2'>
              <h2 className='font-medium text-sm'>Artigos relacionados</h2>
              <SdKbArticleList
                articles={related.data ?? []}
                onSelect={onSelectRelated}
                hrefFor={hrefForRelated}
              />
            </section>
          )}
        </div>
        <aside className='hidden lg:block'>
          <SdKbToc
            content={article.content}
            containerSelector={`#${containerId}`}
            className='sticky top-4'
          />
        </aside>
      </div>
    </article>
  )
}
