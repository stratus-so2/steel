'use client'

import { File02Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Muted } from '@/components/typography/text/muted'
import { cn } from '@/lib/utils'
import type { SdKbArticleSummaryDTO } from '@/types/sd-kb-article'
import { SdKbStatusBadge } from './sd-kb-status-badge'

/**
 * Lista compacta de artigos (home, relacionados, busca). `onSelect` para o
 * portal (sem navegação); senão, links para `hrefFor`.
 */
export function SdKbArticleList({
  articles,
  hrefFor,
  onSelect,
  meta,
  empty = 'Nenhum artigo.',
  showStatus = false,
  excerptFor,
  className,
}: {
  articles: SdKbArticleSummaryDTO[]
  hrefFor?: (article: SdKbArticleSummaryDTO) => string
  onSelect?: (article: SdKbArticleSummaryDTO) => void
  meta?: (article: SdKbArticleSummaryDTO) => React.ReactNode
  empty?: string
  showStatus?: boolean
  excerptFor?: (article: SdKbArticleSummaryDTO) => string | undefined
  className?: string
}) {
  if (articles.length === 0) {
    return <Muted className='py-2 text-sm'>{empty}</Muted>
  }

  return (
    <ul className={cn('divide-y', className)}>
      {articles.map((article) => {
        const body = (
          <>
            <span className='mt-0.5 w-4 shrink-0 text-center'>
              {article.icon ?? (
                <SteelIcon icon={File02Icon} strokeWidth={2} size={15} />
              )}
            </span>
            <span className='min-w-0 flex-1'>
              <span className='flex items-center gap-2'>
                <span className='truncate font-medium text-sm'>
                  {article.title || 'Sem título'}
                </span>
                {showStatus && article.status === 'DRAFT' && (
                  <SdKbStatusBadge status={article.status} />
                )}
              </span>
              {excerptFor?.(article) && (
                <span className='line-clamp-2 text-muted-foreground text-xs'>
                  {excerptFor(article)}
                </span>
              )}
            </span>
            {meta && (
              <span className='shrink-0 text-muted-foreground text-xs tabular-nums'>
                {meta(article)}
              </span>
            )}
          </>
        )
        const itemClass =
          'flex w-full items-start gap-2 px-1 py-2 text-left hover:bg-muted/60 rounded-md'
        return (
          <li key={article.id}>
            {onSelect ? (
              <button
                type='button'
                className={itemClass}
                onClick={() => onSelect(article)}
              >
                {body}
              </button>
            ) : (
              <Link className={itemClass} href={hrefFor?.(article) ?? '#'}>
                {body}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
