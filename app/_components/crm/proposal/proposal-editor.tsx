'use client'

import {
  Analytics01Icon,
  ArrowLeft02Icon,
  File01Icon,
  Globe02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { EditorContent, useEditor } from '@tiptap/react'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import {
  analyzeDoc,
  type DocStats,
} from '@/app/_components/crm/rich-text/analyze'
import { RICH_TEXT_EXTENSIONS } from '@/app/_components/crm/rich-text/tiptap-extensions'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  getCrmProposalMetrics,
  saveCrmProposal,
  useCrmProposal,
} from '@/src/hooks/use-crm-proposal'
import type {
  CrmProposalDTO,
  CrmProposalMetricsDTO,
  CrmProposalStatusDTO,
} from '@/types/crm-proposal'
import { ProposalMetricsDrawer } from './proposal-metrics-drawer'
import { ProposalOptionsMenu } from './proposal-options-menu'
import { ProposalSidebar } from './proposal-sidebar'
import { ProposalToolbar } from './proposal-toolbar'

const EMPTY_STATS: DocStats = {
  words: 0,
  readingMinutes: 0,
  headings: 0,
  media: 0,
}

type ProposalPatch = {
  title?: string
  content?: string
  contentJson?: string
  status?: CrmProposalStatusDTO
}

export function ProposalEditor({
  workspaceId,
  slug,
  proposalId,
}: {
  workspaceId: string
  slug: string
  proposalId: string
}) {
  const { proposal, isLoading, error } = useCrmProposal(workspaceId, proposalId)

  if (isLoading) {
    return (
      <div className='flex h-full flex-col'>
        <div className='flex h-14 items-center gap-2 border-b px-4'>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='ml-auto h-8 w-24' />
        </div>
        <div className='flex-1 p-8'>
          <Skeleton className='mx-auto h-full w-full max-w-3xl' />
        </div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        {error ?? 'Documento não encontrado.'}
      </div>
    )
  }

  return (
    <ProposalEditorInner
      workspaceId={workspaceId}
      slug={slug}
      initial={proposal}
    />
  )
}

function ProposalEditorInner({
  workspaceId,
  slug,
  initial,
}: {
  workspaceId: string
  slug: string
  initial: CrmProposalDTO
}) {
  const router = useRouter()

  const [title, setTitle] = React.useState(initial.title)
  const [status, setStatus] = React.useState<CrmProposalStatusDTO>(
    initial.status,
  )
  const [stats, setStats] = React.useState<DocStats>(EMPTY_STATS)
  const [publishing, setPublishing] = React.useState(false)
  const [metricsOpen, setMetricsOpen] = React.useState(false)
  const [metrics, setMetrics] = React.useState<CrmProposalMetricsDTO | null>(
    null,
  )
  const [shareUrl, setShareUrl] = React.useState('')

  React.useEffect(() => {
    setShareUrl(`${window.location.origin}/p/${initial.shareToken}`)
  }, [initial.shareToken])

  /* ----------------------------- autosave ----------------------------- */
  const pending = React.useRef<ProposalPatch>({})
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = React.useCallback(
    (patch: ProposalPatch) => {
      pending.current = { ...pending.current, ...patch }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const toSave = pending.current
        pending.current = {}
        const saved = await saveCrmProposal(workspaceId, initial.id, toSave)
        if (!saved.ok) notify.error('Não foi possível salvar o documento.')
      }, 600)
    },
    [workspaceId, initial.id],
  )

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  /* ------------------------------ editor ------------------------------- */
  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: initial.content || '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap min-h-full focus:outline-none' },
    },
    onCreate: ({ editor }) => setStats(analyzeDoc(editor)),
    onUpdate: ({ editor }) => {
      setStats(analyzeDoc(editor))
      scheduleSave({
        content: editor.getHTML(),
        contentJson: JSON.stringify(editor.getJSON()),
      })
    },
  })

  /* ------------------------------ metrics ------------------------------ */
  React.useEffect(() => {
    getCrmProposalMetrics(workspaceId, initial.id).then(
      (m) => m && setMetrics(m),
    )
  }, [workspaceId, initial.id])

  /* ------------------------------ actions ------------------------------ */
  const onTitleChange = (next: string) => {
    setTitle(next)
    if (next.trim()) scheduleSave({ title: next.trim() })
  }

  const onToggleStatus = async (online: boolean) => {
    const next: CrmProposalStatusDTO = online ? 'PUBLISHED' : 'DRAFT'
    setStatus(next)
    setPublishing(true)
    const saved = await saveCrmProposal(workspaceId, initial.id, {
      status: next,
    })
    setPublishing(false)
    if (saved.ok) {
      notify.success(online ? 'Documento publicado' : 'Documento despublicado')
    } else {
      setStatus(online ? 'DRAFT' : 'PUBLISHED') // reverte otimismo
      notify.error('Não foi possível alterar a publicação.')
    }
  }

  const online = status === 'PUBLISHED'

  return (
    <div className='flex h-full flex-col'>
      {/* topbar */}
      <header className='flex h-14 shrink-0 items-center gap-2 border-b px-3'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Voltar'
          onClick={() => router.push(`/${slug}/crm/proposals`)}
        >
          <SteelIcon icon={ArrowLeft02Icon} strokeWidth={2} />
        </Button>
        <SteelIcon
          icon={File01Icon}
          strokeWidth={2}
          className='size-4 shrink-0 text-muted-foreground'
        />
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder='Documento sem título'
          aria-label='Título do documento'
          className='min-w-0 flex-1 bg-transparent font-semibold text-sm outline-none placeholder:text-muted-foreground/60'
        />
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
        {online ? (
          <Button
            variant='ghost'
            size='sm'
            nativeButton={false}
            render={
              <a href={shareUrl} target='_blank' rel='noopener noreferrer'>
                <SteelIcon icon={Globe02Icon} strokeWidth={2} />
                Visualizar
              </a>
            }
          />
        ) : null}
        <Button variant='ghost' size='sm' onClick={() => setMetricsOpen(true)}>
          <SteelIcon icon={Analytics01Icon} strokeWidth={2} />
          Métricas
        </Button>
        {editor ? (
          <ProposalOptionsMenu
            editor={editor}
            workspaceId={workspaceId}
            title={title}
            type={initial.type}
          />
        ) : null}
      </header>

      {/* toolbar do TipTap */}
      <div className='flex shrink-0 items-center overflow-x-auto border-b px-3 py-1.5'>
        {editor ? <ProposalToolbar editor={editor} /> : null}
      </div>

      {/* corpo: editor + sidebar */}
      <div className='flex min-h-0 flex-1'>
        <div className='min-w-0 flex-1 overflow-y-auto'>
          <div className='px-8 py-8'>
            {editor ? <EditorContent editor={editor} /> : null}
          </div>
        </div>
        <ProposalSidebar
          stats={stats}
          status={status}
          publishing={publishing}
          onToggleStatus={onToggleStatus}
          shareUrl={shareUrl}
          metrics={metrics}
          onOpenMetrics={() => setMetricsOpen(true)}
        />
      </div>

      <ProposalMetricsDrawer
        workspaceId={workspaceId}
        proposalId={initial.id}
        open={metricsOpen}
        onOpenChange={setMetricsOpen}
        onLoaded={setMetrics}
      />
    </div>
  )
}
