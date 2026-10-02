'use client'

import { SparklesIcon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSdKbDraftSuggestions } from '@/src/hooks/use-sd-knowledge'
import type { SdKbSearchResultDTO } from '@/types/sd-kb-article'

/**
 * Sugestões da base enquanto o chamado está sendo aberto (antes de existir):
 * o que o título e a descrição digitados já encontram na base. Solicitante só
 * recebe artigos publicados no portal — o filtro é do servidor.
 *
 * `onOpen` abre o artigo onde a tela souber mostrar (painel do portal); sem
 * ele, o artigo abre em nova aba.
 */
export function SdKbDraftSuggestions({
  workspaceId,
  workspaceSlug,
  title,
  description,
  categoryIds,
  onOpen,
  className,
}: {
  workspaceId: string
  workspaceSlug?: string
  title: string
  description?: string
  categoryIds?: string[]
  onOpen?: (article: SdKbSearchResultDTO) => void
  className?: string
}) {
  const suggestions = useSdKbDraftSuggestions(workspaceId, {
    title,
    description,
    categoryIds,
  })

  if (suggestions.isLoading) {
    return <Skeleton className='h-14 w-full' aria-label='Buscando artigos' />
  }
  const articles = suggestions.data ?? []
  if (articles.length === 0) return null

  return (
    <section
      aria-label='Artigos que podem resolver'
      className={cn(
        'space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3',
        className,
      )}
    >
      <h4 className='flex items-center gap-1.5 font-medium text-xs'>
        <SteelIcon
          icon={SparklesIcon}
          size={14}
          strokeWidth={2}
          className='text-amber-600 dark:text-amber-400'
        />
        Talvez a base já resolva
      </h4>
      <ul className='space-y-1.5'>
        {articles.map((article) => (
          <li key={article.id} className='min-w-0'>
            {onOpen ? (
              <button
                type='button'
                className='text-left text-sm hover:underline'
                onClick={() => onOpen(article)}
              >
                {article.title || 'Sem título'}
              </button>
            ) : (
              <a
                href={`/${workspaceSlug ?? ''}/servicedesk/knowledge/${article.id}`}
                target='_blank'
                rel='noreferrer'
                className='text-sm hover:underline'
              >
                {article.title || 'Sem título'}
              </a>
            )}
            {article.excerpt ? (
              <p className='line-clamp-2 text-muted-foreground text-xs'>
                {article.excerpt}
              </p>
            ) : null}
            {article.reuseCount > 0 ? (
              <p className='text-muted-foreground text-xs'>
                Já resolveu {article.reuseCount}{' '}
                {article.reuseCount === 1 ? 'chamado' : 'chamados'}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
