'use client'

import {
  Analytics01Icon,
  ArrowLeft02Icon,
  BrowserIcon,
  Globe02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { CrmLandingPageMetrics } from '@/app/_components/crm/crm-landing-page-metrics'
import { CrmLandingPageChat } from '@/app/_components/crm/landing-page/crm-landing-page-chat'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  saveCrmLandingPage,
  useCrmLandingPage,
} from '@/src/hooks/use-crm-landing-page'
import type { AiProviderId } from '@/src/lib/ai/provider-meta'
import type {
  CrmLandingPageDTO,
  CrmLandingPageStatusDTO,
} from '@/types/crm-landing-page'

export function CrmLandingPageBuilder({
  workspaceId,
  slug,
  pageId,
  providers = ['openai'],
}: {
  workspaceId: string
  slug: string
  pageId: string
  /** Provedores de IA disponíveis (configurados no servidor). */
  providers?: AiProviderId[]
}) {
  const { page, isLoading, error } = useCrmLandingPage(workspaceId, pageId)

  if (isLoading) {
    return (
      <div className='flex h-full flex-col'>
        <div className='flex h-14 items-center gap-2 border-b px-4'>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='ml-auto h-8 w-24' />
        </div>
        <div className='flex flex-1 gap-0'>
          <Skeleton className='m-3 h-full w-80' />
          <Skeleton className='m-3 h-full flex-1' />
        </div>
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        {error ?? 'Página não encontrada.'}
      </div>
    )
  }

  return (
    <CrmLandingPageBuilderInner
      workspaceId={workspaceId}
      slug={slug}
      initial={page}
      providers={providers}
    />
  )
}

function CrmLandingPageBuilderInner({
  workspaceId,
  slug,
  initial,
  providers,
}: {
  workspaceId: string
  slug: string
  initial: CrmLandingPageDTO
  providers: AiProviderId[]
}) {
  const router = useRouter()

  const [title, setTitle] = React.useState(initial.title)
  const [status, setStatus] = React.useState<CrmLandingPageStatusDTO>(
    initial.status,
  )
  const [html, setHtml] = React.useState(initial.html)
  const [publishing, setPublishing] = React.useState(false)
  const [metricsOpen, setMetricsOpen] = React.useState(false)
  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/l/${initial.shareToken}`
      : ''

  /* ----------------------------- autosave título ---------------------- */
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const onTitleChange = (next: string) => {
    setTitle(next)
    if (!next.trim()) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const saved = await saveCrmLandingPage(workspaceId, initial.id, {
        title: next.trim(),
      })
      if (!saved.ok) notify.error('Não foi possível salvar o título.')
    }, 600)
  }

  const onToggleStatus = async (online: boolean) => {
    const next: CrmLandingPageStatusDTO = online ? 'PUBLISHED' : 'DRAFT'
    setStatus(next)
    setPublishing(true)
    const saved = await saveCrmLandingPage(workspaceId, initial.id, {
      status: next,
    })
    setPublishing(false)
    if (saved.ok) {
      notify.success(online ? 'Página publicada' : 'Página despublicada')
    } else {
      setStatus(online ? 'DRAFT' : 'PUBLISHED')
      notify.error('Não foi possível alterar a publicação.')
    }
  }

  const onHtml = React.useCallback(
    (next: string) => {
      setHtml(next)
      saveCrmLandingPage(workspaceId, initial.id, { html: next }).then(
        (saved) => {
          if (!saved.ok) notify.error('Não foi possível salvar a página.')
        },
      )
    },
    [workspaceId, initial.id],
  )

  const online = status === 'PUBLISHED'

  return (
    <div className='flex h-full flex-col'>
      <header className='flex h-14 shrink-0 items-center gap-2 border-b px-3'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Voltar'
          onClick={() => router.push(`/${slug}/crm/landing-pages`)}
        >
          <SteelIcon icon={ArrowLeft02Icon} strokeWidth={2} />
        </Button>
        <SteelIcon
          icon={BrowserIcon}
          strokeWidth={2}
          className='size-4 shrink-0 text-muted-foreground'
        />
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder='Página sem título'
          aria-label='Título da página'
          className='min-w-0 flex-1 bg-transparent font-semibold text-sm outline-none placeholder:text-muted-foreground/60'
        />

        <Button variant='ghost' size='sm' onClick={() => setMetricsOpen(true)}>
          <SteelIcon icon={Analytics01Icon} strokeWidth={2} />
          Métricas
        </Button>

        {online ? (
          <Button
            variant='ghost'
            size='sm'
            nativeButton={false}
            render={
              <a href={publicUrl} target='_blank' rel='noopener noreferrer'>
                <SteelIcon icon={Globe02Icon} strokeWidth={2} />
                Visualizar
              </a>
            }
          />
        ) : null}

        <div className='flex items-center gap-2 pl-1'>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs',
              online
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                : 'border-border bg-muted text-muted-foreground',
            )}
          >
            {online ? 'Online' : 'Offline'}
          </span>
          <Switch
            checked={online}
            disabled={publishing}
            onCheckedChange={onToggleStatus}
            aria-label='Publicar página'
          />
        </div>
      </header>

      <div className='flex min-h-0 flex-1'>
        <aside className='flex w-[360px] shrink-0 flex-col border-r'>
          <CrmLandingPageChat
            workspaceId={workspaceId}
            pageId={initial.id}
            hasContent={html.trim().length > 0}
            onHtml={onHtml}
            providers={providers}
          />
        </aside>
        <main className='min-w-0 flex-1 bg-muted/30 p-3'>
          {html.trim() ? (
            <iframe
              title='Pré-visualização da página'
              srcDoc={html}
              sandbox='allow-scripts allow-same-origin'
              className='h-full w-full rounded-lg border bg-white'
            />
          ) : (
            <div className='flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-muted-foreground text-sm'>
              <SteelIcon
                icon={BrowserIcon}
                strokeWidth={2}
                className='size-8 opacity-40'
              />
              <p className='max-w-xs'>
                Sua página aparecerá aqui. Descreva no chat ao lado o que você
                quer criar.
              </p>
            </div>
          )}
        </main>
      </div>

      {metricsOpen ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-4 shadow-lg'>
            <div className='mb-3 flex items-center justify-between'>
              <h2 className='font-semibold text-sm'>Métricas de acesso</h2>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setMetricsOpen(false)}
              >
                Fechar
              </Button>
            </div>
            <CrmLandingPageMetrics
              workspaceId={workspaceId}
              pageId={initial.id}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
