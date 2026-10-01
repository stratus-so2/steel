'use client'

import {
  ArrowLeft01Icon,
  BookOpen01Icon,
  Search01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { KbRichViewer } from '@/components/editor/kb-viewer'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useSdPortalArticle,
  useSdPortalKnowledge,
} from '@/src/hooks/use-sd-external-portal'

/** Leitura de um artigo publicado no portal. */
function Article({
  articleId,
  onBack,
}: {
  articleId: string
  onBack: () => void
}) {
  const query = useSdPortalArticle(articleId)

  if (query.isError) {
    return (
      <div className='flex flex-col items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4'>
        <p className='text-red-700 text-sm dark:text-red-300'>
          {query.error.message}
        </p>
        <Button variant='outline' size='sm' onClick={onBack}>
          Voltar
        </Button>
      </div>
    )
  }

  if (!query.data) return <Skeleton className='h-64 rounded-2xl' />

  return (
    <article className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-5'>
      <Button variant='ghost' size='sm' className='self-start' onClick={onBack}>
        <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        Voltar para a base de conhecimento
      </Button>
      <h1 className='font-semibold text-xl'>{query.data.title}</h1>
      <p className='text-muted-foreground text-xs'>
        {query.data.readingMinutes} min de leitura
      </p>
      <KbRichViewer content={query.data.content} />
    </article>
  )
}

/**
 * `/suporte/ajuda`: a base de conhecimento publicada no portal (passo a
 * passo e respostas rápidas escritas pela equipe). Artigos internos e
 * rascunhos nunca chegam aqui — a API só devolve `PUBLISHED` + `PORTAL`.
 */
export function SdExtKnowledge() {
  const [articleId, setArticleId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const query = useSdPortalKnowledge(q.trim(), categoryId)

  if (articleId) {
    return <Article articleId={articleId} onBack={() => setArticleId(null)} />
  }

  const articles = query.data?.articles ?? []
  const categories = query.data?.categories ?? []

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <h2 className='font-semibold text-lg'>Como podemos ajudar?</h2>
        <div className='relative'>
          <SteelIcon
            icon={Search01Icon}
            strokeWidth={2}
            className='pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground'
          />
          <Input
            type='search'
            value={q}
            aria-label='Buscar na base de conhecimento'
            placeholder='Busque por uma palavra (ex.: senha, impressora)'
            className='pl-9'
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
      </div>

      {categories.length > 0 ? (
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            aria-pressed={categoryId === undefined}
            onClick={() => setCategoryId(undefined)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs transition-colors',
              categoryId === undefined
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type='button'
              aria-pressed={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs transition-colors',
                categoryId === category.id
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      {query.isError ? (
        <p className='rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-700 text-sm dark:text-red-300'>
          {query.error.message}
        </p>
      ) : query.isLoading ? (
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-16 rounded-xl' />
          <Skeleton className='h-16 rounded-xl' />
        </div>
      ) : articles.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-xl border border-border border-dashed bg-card/40 p-8 text-center'>
          <SteelIcon
            icon={BookOpen01Icon}
            strokeWidth={1.8}
            className='size-6 text-muted-foreground'
          />
          <p className='font-medium text-sm'>Nenhum artigo encontrado</p>
          <p className='max-w-sm text-muted-foreground text-xs'>
            Se não achou o que procurava, abra um chamado — a equipe responde.
          </p>
          <Link
            href='/suporte/novo'
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Abrir chamado
          </Link>
        </div>
      ) : (
        <ul className='flex flex-col gap-2'>
          {articles.map((article) => (
            <li key={article.id}>
              <button
                type='button'
                onClick={() => setArticleId(article.id)}
                className='flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-blue-500/40'
              >
                <span className='font-medium text-sm'>{article.title}</span>
                {article.tags.length > 0 ? (
                  <span className='text-muted-foreground text-xs'>
                    {article.tags.join(' · ')}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
