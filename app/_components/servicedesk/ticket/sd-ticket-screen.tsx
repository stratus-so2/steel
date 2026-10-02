'use client'

import {
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowUpDoubleIcon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  HierarchyIcon,
  Link01Icon,
  MoreHorizontalIcon,
  Unlink01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSdAgents, useSdConfig, useSdMe } from '@/src/hooks/use-sd-config'
import { useSdTicketKbLinks } from '@/src/hooks/use-sd-knowledge'
import {
  useDeleteSdTicket,
  useSdTicket,
  useSdTicketRealtime,
  useSetSdTicketParent,
  useUpdateSdTicket,
} from '@/src/hooks/use-sd-tickets'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SdRiskBadge, SdRiskWidget } from '../risk/sd-risk-badge'
import { SdCreateTicketSheet } from './sd-create-ticket-sheet'
import { SdFollowButton } from './sd-follow-button'
import { SdOnCallBadge } from './sd-oncall-badge'
import { SdOptionSelect } from './sd-option-select'
import { useSdPhaseMover } from './sd-phase-mover'
import { SdRichTextEditor, SdRichTextView } from './sd-rich-text-editor'
import {
  SdLevelBadge,
  SdProgressBar,
  SdSlaWidget,
  SdTypeBadge,
  useSdNow,
} from './sd-ticket-badges'
import {
  SD_PHASE_CATEGORY_COLOR,
  SD_TICKET_TYPE_PLURAL,
  SD_TONE,
  SD_TYPE_ROUTE,
  sdTicketHref,
} from './sd-ticket-meta'
import { sdTypePhases } from './sd-ticket-options'
import { SdTicketPicker } from './sd-ticket-picker'
import { SdTicketSidebar } from './sd-ticket-sidebar'
import { SdTicketTabs, sdResolveTab } from './ticket-tabs'

function EditableTitle({
  workspaceId,
  ticket,
}: {
  workspaceId: string
  ticket: SdTicketDTO
}) {
  const update = useUpdateSdTicket(workspaceId, ticket.id)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(ticket.title)

  function save() {
    const title = value.trim()
    setEditing(false)
    if (!title || title === ticket.title) {
      setValue(ticket.title)
      return
    }
    update.mutate(
      { title },
      {
        onError: (e) => {
          notify.error(e)
          setValue(ticket.title)
        },
      },
    )
  }

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label='Título do chamado'
        value={value}
        maxLength={200}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') {
            setValue(ticket.title)
            setEditing(false)
          }
        }}
        className='h-9 font-semibold text-lg'
      />
    )
  }
  return (
    <button
      type='button'
      onClick={() => {
        setValue(ticket.title)
        setEditing(true)
      }}
      className='group flex min-w-0 items-center gap-2 text-left'
      title='Editar título'
    >
      <h1 className='truncate font-semibold text-lg leading-tight'>
        {ticket.title}
      </h1>
      <SteelIcon
        icon={Edit02Icon}
        strokeWidth={2}
        className='size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100'
      />
    </button>
  )
}

function Description({
  workspaceId,
  ticket,
}: {
  workspaceId: string
  ticket: SdTicketDTO
}) {
  const update = useUpdateSdTicket(workspaceId, ticket.id)
  const [editing, setEditing] = useState(false)
  const [html, setHtml] = useState(ticket.description ?? '')
  return (
    <section className='border-b px-4 py-3'>
      <div className='mb-1.5 flex items-center gap-2'>
        <h2 className='font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
          Descrição
        </h2>
        {editing ? (
          <div className='ml-auto flex gap-1'>
            <Button variant='ghost' size='xs' onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button
              size='xs'
              disabled={update.isPending}
              onClick={() =>
                update.mutate(
                  { description: html || null },
                  {
                    onSuccess: () => setEditing(false),
                    onError: notify.error,
                  },
                )
              }
            >
              Salvar
            </Button>
          </div>
        ) : (
          <Button
            variant='ghost'
            size='xs'
            className='ml-auto'
            onClick={() => {
              setHtml(ticket.description ?? '')
              setEditing(true)
            }}
          >
            <SteelIcon icon={Edit02Icon} strokeWidth={2} />
            Editar
          </Button>
        )}
      </div>
      {editing ? (
        <SdRichTextEditor value={html} onChange={setHtml} minHeight={120} />
      ) : (
        <SdRichTextView
          html={ticket.description}
          className='max-h-64 overflow-y-auto'
        />
      )}
    </section>
  )
}

function Header({
  workspaceId,
  slug,
  ticket,
  config,
  isAdmin,
  onPhaseChange,
  onTab,
}: {
  workspaceId: string
  slug: string
  ticket: SdTicketDTO
  config: SdConfigBootstrapDTO
  isAdmin: boolean
  onPhaseChange: (phaseId: string) => void
  onTab: (tab: string) => void
}) {
  const router = useRouter()
  const now = useSdNow(30_000)
  const remove = useDeleteSdTicket(workspaceId)
  const setParent = useSetSdTicketParent(workspaceId, ticket.id)
  const [creatingChild, setCreatingChild] = useState(false)
  const [linkingParent, setLinkingParent] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const phases = sdTypePhases(config, ticket.type)
  const phaseColor =
    ticket.phase.color ?? SD_PHASE_CATEGORY_COLOR[ticket.phase.category]
  const boardHref = `/${slug}/servicedesk/${SD_TYPE_ROUTE[ticket.type]}`

  function copyLink() {
    const url = `${window.location.origin}${sdTicketHref(slug, ticket)}`
    void navigator.clipboard
      ?.writeText(url)
      .then(() => notify.success('Link copiado.'))
      .catch(() => notify.error('Não foi possível copiar o link.'))
  }

  return (
    <header className='flex shrink-0 flex-col gap-3 border-b bg-background px-4 pt-3 pb-3'>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <Link
          href={boardHref}
          className='inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground'
        >
          <SteelIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            className='size-3.5'
          />
          {SD_TICKET_TYPE_PLURAL[ticket.type]}
        </Link>
        <span className='text-muted-foreground'>/</span>
        <button
          type='button'
          onClick={copyLink}
          className='inline-flex items-center gap-1 font-medium font-mono text-xs hover:underline'
          title='Copiar link'
        >
          {ticket.code}
          <SteelIcon
            icon={Copy01Icon}
            strokeWidth={2}
            className='size-3 text-muted-foreground'
          />
        </button>
        <SdTypeBadge type={ticket.type} />
        <SdLevelBadge level={ticket.priority} prefix='Prioridade' />
        <SdLevelBadge level={ticket.severity} prefix='Severidade' />
        {ticket.escalationLevel > 0 ? (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 font-medium text-xs',
              SD_TONE.orange,
            )}
          >
            Escalonado N{ticket.escalationLevel}
          </span>
        ) : null}
        <SdRiskBadge risk={ticket.risk} />
        <SdOnCallBadge
          workspaceId={workspaceId}
          departmentId={ticket.department?.id}
        />
        {ticket.parent ? (
          <Link
            href={`/${slug}/servicedesk/tickets/${ticket.parent.number}`}
            className='inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-muted-foreground text-xs hover:text-foreground'
          >
            <SteelIcon
              icon={HierarchyIcon}
              strokeWidth={2}
              className='size-3'
            />
            Filho de {ticket.parent.code}
          </Link>
        ) : null}

        <div className='ml-auto flex items-center gap-2'>
          <SdFollowButton workspaceId={workspaceId} ticketRef={ticket.id} />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='outline'
                  size='icon-sm'
                  aria-label='Ações do chamado'
                >
                  <SteelIcon icon={MoreHorizontalIcon} strokeWidth={2} />
                </Button>
              }
            />
            <DropdownMenuContent align='end' className='w-52'>
              <DropdownMenuItem onClick={() => onTab('escalation')}>
                <SteelIcon icon={ArrowUpDoubleIcon} strokeWidth={2} />
                Escalonar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreatingChild(true)}>
                <SteelIcon icon={HierarchyIcon} strokeWidth={2} />
                Adicionar item filho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinkingParent(true)}>
                <SteelIcon icon={Link01Icon} strokeWidth={2} />
                {ticket.parent ? 'Trocar item pai' : 'Vincular item pai'}
              </DropdownMenuItem>
              {ticket.parent ? (
                <DropdownMenuItem
                  onClick={() =>
                    setParent.mutate(null, {
                      onSuccess: () => notify.success('Item pai removido.'),
                      onError: notify.error,
                    })
                  }
                >
                  <SteelIcon icon={Unlink01Icon} strokeWidth={2} />
                  Remover item pai
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={copyLink}>
                <SteelIcon icon={Copy01Icon} strokeWidth={2} />
                Copiar link
              </DropdownMenuItem>
              {isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant='destructive'
                    onClick={() => setDeleting(true)}
                  >
                    <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                    Excluir chamado
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditableTitle
        key={ticket.title}
        workspaceId={workspaceId}
        ticket={ticket}
      />

      <div className='flex flex-wrap items-stretch gap-3'>
        <div className='flex min-w-60 flex-1 flex-col justify-center gap-1.5 rounded-lg border bg-card/60 px-2.5 py-1.5'>
          <div className='flex items-center gap-2'>
            <span className='font-medium text-[11px] text-muted-foreground uppercase tracking-wide'>
              Fase
            </span>
            <span className='ml-auto font-semibold text-xs tabular-nums'>
              {ticket.completionPercent}%
            </span>
          </div>
          <SdOptionSelect
            aria-label='Mudar fase'
            allowClear={false}
            value={ticket.phaseId}
            onChange={(phaseId) => phaseId && onPhaseChange(phaseId)}
            options={phases.map((p) => ({
              value: p.id,
              label: p.name,
              color: p.color ?? SD_PHASE_CATEGORY_COLOR[p.category],
              hint: `${p.completionPercent}%`,
            }))}
          />
          <SdProgressBar
            percent={ticket.completionPercent}
            color={phaseColor}
          />
        </div>
        <SdSlaWidget
          label='1ª resposta'
          timer={ticket.sla.firstResponse}
          now={now}
          doneAt={ticket.firstRespondedAt}
        />
        <SdSlaWidget
          label='Resolução'
          timer={ticket.sla.resolution}
          now={now}
          doneAt={ticket.resolvedAt}
        />
        <SdRiskWidget risk={ticket.risk} now={now} />
      </div>

      <SdCreateTicketSheet
        workspaceId={workspaceId}
        slug={slug}
        open={creatingChild}
        onOpenChange={setCreatingChild}
        defaultType={ticket.type}
        preset={{
          type: ticket.type,
          parent: { id: ticket.id, label: `${ticket.code} · ${ticket.title}` },
        }}
        onCreated={() => onTab('children')}
      />

      <Dialog open={linkingParent} onOpenChange={setLinkingParent}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Vincular item pai</DialogTitle>
            <DialogDescription>
              {ticket.code} passa a ser item filho do chamado escolhido.
            </DialogDescription>
          </DialogHeader>
          <SdTicketPicker
            workspaceId={workspaceId}
            value={null}
            excludeIds={[ticket.id]}
            onChange={(option) =>
              option &&
              setParent.mutate(option.id, {
                onSuccess: () => {
                  notify.success('Item pai definido.')
                  setLinkingParent(false)
                },
                onError: notify.error,
              })
            }
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {ticket.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              O chamado sai dos quadros e relatórios. A rastreabilidade é
              preservada para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(ticket.id, {
                  onSuccess: () => {
                    notify.success(`${ticket.code} excluído.`)
                    router.push(boardHref)
                  },
                  onError: notify.error,
                })
              }
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}

/**
 * Tela do chamado (agente): cabeçalho fixo (código, título editável, fase
 * com % e SLAs ao vivo, ações), coluna principal com descrição e abas
 * (lembradas em `?tab=`) e barra lateral com todos os campos editáveis.
 * Atualiza em tempo real a cada evento deste chamado.
 */
export function SdTicketScreen({
  workspaceId,
  slug,
  ticketRef,
}: {
  workspaceId: string
  slug: string
  ticketRef: string
}) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const ticket = useSdTicket(workspaceId, ticketRef)
  const config = useSdConfig(workspaceId)
  const me = useSdMe(workspaceId)
  const agents = useSdAgents(workspaceId, { includeRequesters: true })
  const kbLinks = useSdTicketKbLinks(workspaceId, ticket.data?.id ?? '')
  useSdTicketRealtime(workspaceId)

  const mover = useSdPhaseMover({
    workspaceId,
    slug,
    config: config.data,
    agents: agents.data ?? [],
  })
  const tab = sdResolveTab(params.get('tab'), 'agent', ticket.data?.type)

  function setTab(next: string) {
    const search = new URLSearchParams(params.toString())
    search.set('tab', next)
    router.replace(`${pathname}?${search.toString()}`, { scroll: false })
  }

  if (ticket.isLoading || config.isLoading || me.isLoading) {
    return (
      <div className='flex flex-col gap-3 p-4'>
        <Skeleton className='h-5 w-48' />
        <Skeleton className='h-8 w-2/3' />
        <Skeleton className='h-16 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  if (ticket.error || !ticket.data || !config.data || !me.data) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
        <SteelIcon
          icon={Alert02Icon}
          strokeWidth={1.8}
          className='size-6 text-muted-foreground'
        />
        <p className='font-medium text-sm'>Chamado não encontrado</p>
        <p className='max-w-sm text-muted-foreground text-xs'>
          {ticket.error?.message ??
            'Ele pode ter sido excluído ou você não tem acesso.'}
        </p>
        <Link
          href={`/${slug}/servicedesk/tickets`}
          className='text-primary text-sm hover:underline'
        >
          Voltar aos chamados
        </Link>
      </div>
    )
  }

  const data = ticket.data
  return (
    <div className='flex h-full min-h-0 flex-col'>
      <Header
        workspaceId={workspaceId}
        slug={slug}
        ticket={data}
        config={config.data}
        isAdmin={me.data.isAdmin}
        onPhaseChange={(phaseId) => mover.move(data, phaseId)}
        onTab={setTab}
      />
      <div className='grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]'>
        <main className='min-h-0 overflow-y-auto'>
          <Description
            key={data.description ?? ''}
            workspaceId={workspaceId}
            ticket={data}
          />
          <SdTicketTabs
            active={tab}
            onChange={setTab}
            counts={{
              children: data.childrenCount,
              escalation: data.escalationLevel,
              knowledge: kbLinks.data?.length,
            }}
            props={{
              workspaceId,
              slug,
              ticket: data,
              me: me.data,
              mode: 'agent',
            }}
          />
        </main>
        <SdTicketSidebar
          workspaceId={workspaceId}
          ticket={data}
          config={config.data}
          agents={agents.data ?? []}
          onPhaseChange={(phaseId) => mover.move(data, phaseId)}
        />
      </div>
      {mover.dialog}
    </div>
  )
}
