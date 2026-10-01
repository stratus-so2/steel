'use client'

import type { IconSvgElement } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  HistoryIcon,
  RefreshIcon,
  SignatureIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSdMe } from '@/src/hooks/use-sd-config'
import { useSendSdTicketMessage } from '@/src/hooks/use-sd-ticket-messages'
import { useSdTicket, useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import type { SdTicketDTO } from '@/types/sd-ticket'
import {
  SdPhaseBadge,
  SdProgressBar,
  SdTypeBadge,
} from '../ticket/sd-ticket-badges'
import {
  SD_PHASE_CATEGORY_LABEL,
  sdFormatDateTime,
  sdRelativeTime,
} from '../ticket/sd-ticket-meta'
import { SdTicketHistoryTab } from '../ticket/tabs/history-tab'
import { SdTicketSignatureTab } from '../ticket/tabs/signature-tab'
import type { SdTicketTabProps } from '../ticket/tabs/types'
import { SdPortalCsat } from './sd-portal-csat'

const DONE = new Set(['RESOLVED', 'CLOSED'])
const REOPENABLE = new Set(['RESOLVED', 'CLOSED', 'CANCELED'])

const PORTAL_TABS: {
  id: 'history' | 'signature'
  label: string
  icon: IconSvgElement
  component: (props: SdTicketTabProps) => React.ReactNode
}[] = [
  {
    id: 'history',
    label: 'Conversa',
    icon: HistoryIcon,
    component: SdTicketHistoryTab,
  },
  {
    id: 'signature',
    label: 'Assinatura',
    icon: SignatureIcon,
    component: SdTicketSignatureTab,
  },
]

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='truncate font-medium text-sm'>{value}</dd>
    </div>
  )
}

function catalogPath(ticket: SdTicketDTO): string {
  const parts = [ticket.category, ticket.subcategory, ticket.service]
    .filter((node) => node !== null)
    .map((node) => node.name)
  return parts.length > 0 ? parts.join(' › ') : 'Não informado'
}

/** Caixa de reabertura: uma mensagem do solicitante reabre o chamado. */
function ReopenDialog({
  workspaceId,
  ticketRef,
  open,
  onOpenChange,
}: {
  workspaceId: string
  ticketRef: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const send = useSendSdTicketMessage(workspaceId, ticketRef)
  const [text, setText] = useState('')

  async function submit() {
    const body = text.trim()
    if (!body) return
    try {
      await send.mutateAsync({ body })
      notify.success('Enviado! A equipe vai retomar o atendimento.')
      setText('')
      onOpenChange(false)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Reabrir chamado</DialogTitle>
          <DialogDescription>
            Conte o que ainda não ficou resolvido. Sua mensagem volta para a
            equipe que atendeu você.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          autoFocus
          maxLength={5000}
          value={text}
          aria-label='Motivo da reabertura'
          placeholder='O problema voltou a acontecer quando…'
          onChange={(event) => setText(event.target.value)}
        />
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!text.trim() || send.isPending}
            onClick={() => void submit()}
          >
            {send.isPending ? 'Enviando…' : 'Reabrir chamado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Tela do chamado no portal do solicitante: situação com o progresso da
 * fase, as informações que interessam a quem pediu, a conversa com a equipe,
 * a assinatura, a avaliação do atendimento e o botão de reabrir.
 */
export function SdPortalTicket({
  workspaceId,
  slug,
  ticketRef,
}: {
  workspaceId: string
  slug: string
  /** Número, código (`INC-000123`) ou id do chamado. */
  ticketRef: string
}) {
  useSdTicketRealtime(workspaceId)
  const query = useSdTicket(workspaceId, ticketRef)
  const me = useSdMe(workspaceId)
  const [tab, setTab] = useState<'history' | 'signature'>('history')
  const [reopenOpen, setReopenOpen] = useState(false)

  const ticket = query.data
  const portalHref = `/${slug}/servicedesk/portal`

  if (query.error) {
    return (
      <div className='mx-auto flex w-full max-w-4xl flex-col items-center gap-3 p-10 text-center'>
        <p className='font-medium text-sm'>Não encontramos este chamado</p>
        <p className='max-w-md text-muted-foreground text-xs'>
          {query.error.message}
        </p>
        <Link
          href={portalHref}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Voltar ao portal
        </Link>
      </div>
    )
  }

  if (!ticket || !me.data) {
    return (
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-3 p-6'>
        <Skeleton className='h-24 rounded-xl' />
        <Skeleton className='h-64 rounded-xl' />
      </div>
    )
  }

  const done = DONE.has(ticket.phase.category)
  const canReopen = REOPENABLE.has(ticket.phase.category)
  const tabProps: SdTicketTabProps = {
    workspaceId,
    slug,
    ticket,
    me: me.data,
    mode: 'requester',
  }
  const ActiveTab =
    PORTAL_TABS.find((item) => item.id === tab)?.component ?? SdTicketHistoryTab

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-5 p-6'>
      <header className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm'>
        <div className='flex flex-wrap items-center gap-2'>
          <Link
            href={portalHref}
            aria-label='Voltar ao portal'
            className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
          >
            <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
          <span className='font-mono text-muted-foreground text-xs'>
            {ticket.code}
          </span>
          <SdTypeBadge type={ticket.type} />
          <SdPhaseBadge phase={ticket.phase} />
          {canReopen ? (
            <Button
              size='xs'
              variant='outline'
              className='ml-auto'
              onClick={() => setReopenOpen(true)}
            >
              <SteelIcon icon={RefreshIcon} strokeWidth={2} />
              Reabrir
            </Button>
          ) : null}
        </div>
        <h1 className='font-semibold text-lg'>{ticket.title}</h1>
        <div className='flex items-center gap-3'>
          <SdProgressBar
            percent={ticket.completionPercent}
            color={ticket.phase.color}
            className='w-full'
          />
          <span className='shrink-0 text-muted-foreground text-xs tabular-nums'>
            {ticket.completionPercent}%
          </span>
        </div>
        <p className='text-muted-foreground text-xs'>
          Situação: {SD_PHASE_CATEGORY_LABEL[ticket.phase.category]} · última
          movimentação {sdRelativeTime(ticket.lastActivityAt)}
        </p>
      </header>

      <dl className='grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4'>
        <Info label='Aberto em' value={sdFormatDateTime(ticket.createdAt)} />
        <Info label='Assunto' value={catalogPath(ticket)} />
        <Info
          label='Quem está atendendo'
          value={ticket.assignee?.name ?? 'Aguardando a equipe'}
        />
        <Info
          label='Urgência'
          value={ticket.urgency?.name ?? 'Não informada'}
        />
      </dl>

      {done ? (
        <SdPortalCsat
          workspaceId={workspaceId}
          ticketRef={ticket.id}
          csatScore={ticket.csatScore}
          csatComment={ticket.csatComment}
        />
      ) : null}

      <section className='flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card'>
        <div
          role='tablist'
          aria-label='Seções do chamado'
          className='flex shrink-0 items-center gap-0.5 border-b px-2'
        >
          {PORTAL_TABS.map((item) => {
            const selected = item.id === tab
            return (
              <button
                key={item.id}
                type='button'
                role='tab'
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={cn(
                  '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 font-medium text-sm transition-colors',
                  selected
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <SteelIcon
                  icon={item.icon}
                  strokeWidth={2}
                  className='size-4'
                />
                {item.label}
              </button>
            )
          })}
        </div>
        <div className='min-h-0 flex-1'>
          <ActiveTab {...tabProps} />
        </div>
      </section>

      <ReopenDialog
        workspaceId={workspaceId}
        ticketRef={ticket.id}
        open={reopenOpen}
        onOpenChange={setReopenOpen}
      />
    </div>
  )
}
