'use client'

import { ArrowLeft01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useSdKbArticles,
  useSdKbCategories,
  useSdKbSearch,
} from '@/src/hooks/use-sd-knowledge'
import type { SdKbArticleSummaryDTO } from '@/types/sd-kb-article'
import { SdKbArticleList } from './sd-kb-article-list'
import { SdKbArticleView } from './sd-kb-article-view'
import { SdKbCategoryCards } from './sd-kb-category-cards'
import { SdKbSearchBox } from './sd-kb-search-box'
import { sdKbTop } from './sd-kb-utils'

export interface SdKbPortalBrowserProps {
  workspaceId: string
  /** Abre direto num artigo. */
  initialArticleId?: string
  /** Avisado ao abrir/fechar um artigo (ex.: sincronizar a URL). */
  onArticleChange?: (articleId: string | null) => void
  className?: string
}

/**
 * KB do portal do solicitante: busca, categorias, mais úteis e a leitura do
 * artigo — tudo sem sair da tela. A API já restringe o solicitante a artigos
 * publicados com visibilidade portal; agentes que abrirem veem o mesmo
 * recorte porque a lista usa só os publicados.
 */
export function SdKbPortalBrowser({
  workspaceId,
  initialArticleId,
  onArticleChange,
  className,
}: SdKbPortalBrowserProps) {
  const [articleId, setArticleId] = useState<string | null>(
    initialArticleId ?? null,
  )
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<string>()
  const filtering = q.trim().length > 0 || !!categoryId

  const articles = useSdKbArticles(workspaceId)
  const categories = useSdKbCategories(workspaceId)
  const search = useSdKbSearch(
    workspaceId,
    {
      q: q.trim(),
      categoryId,
      limit: 30,
      status: 'PUBLISHED',
      visibility: 'PORTAL',
    },
    filtering,
  )

  const portal = useMemo(
    () =>
      (articles.data ?? []).filter(
        (a) => a.status === 'PUBLISHED' && a.visibility === 'PORTAL',
      ),
    [articles.data],
  )
  const excerpts = useMemo(
    () => new Map((search.data ?? []).map((r) => [r.id, r.excerpt])),
    [search.data],
  )

  function open(article: SdKbArticleSummaryDTO | null) {
    const id = article?.id ?? null
    setArticleId(id)
    onArticleChange?.(id)
  }

  if (articleId) {
    return (
      <div className={cn('space-y-2', className)}>
        <Button variant='ghost' size='sm' onClick={() => open(null)}>
          <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Voltar para a base de conhecimento
        </Button>
        <SdKbArticleView
          workspaceId={workspaceId}
          articleId={articleId}
          onSelectRelated={open}
        />
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className='space-y-2'>
        <h2 className='font-semibold text-xl'>Como podemos ajudar?</h2>
        <SdKbSearchBox value={q} onChange={setQ} />
      </div>

      {(categories.data?.length ?? 0) > 0 && (
        <SdKbCategoryCards
          categories={categories.data ?? []}
          selectedId={categoryId}
          onSelect={setCategoryId}
        />
      )}

      {filtering ? (
        search.isLoading ? (
          <Skeleton className='h-24 w-full' />
        ) : (
          <SdKbArticleList
            articles={search.data ?? []}
            onSelect={open}
            excerptFor={(a) => excerpts.get(a.id)}
            empty='Nenhum artigo encontrado. Se precisar, abra um chamado.'
          />
        )
      ) : articles.isLoading ? (
        <Skeleton className='h-24 w-full' />
      ) : (
        <section className='space-y-2'>
          <h3 className='font-medium text-sm'>Artigos mais úteis</h3>
          <SdKbArticleList
            articles={
              sdKbTop(portal, 'helpfulCount', 8).length
                ? sdKbTop(portal, 'helpfulCount', 8)
                : sdKbTop(portal, 'updatedAt', 8)
            }
            onSelect={open}
            empty='Ainda não há artigos publicados no portal.'
          />
        </section>
      )}
    </div>
  )
}
