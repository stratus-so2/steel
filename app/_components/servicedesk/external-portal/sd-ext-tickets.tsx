'use client'

import {
  Add01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSdPortalTickets } from '@/src/hooks/use-sd-external-portal'
import type { SdPortalTicketSummaryDTO } from '@/types/sd-portal'
import {
  SdPhaseBadge,
  SdProgressBar,
  SdTypeBadge,
} from '../ticket/sd-ticket-badges'
import { sdRelativeTime } from '../ticket/sd-ticket-meta'

const TABS = [
  { id: 'open', label: 'Em aberto' },
  { id: 'closed', label: 'Encerrados' },
] as const

type Tab = (typeof TABS)[number]['id']

/** `/suporte/chamados/<código>`. */
export function sdExtTicketHref(code: string): string {
  return `/suporte/chamados/${encodeURIComponent(code)}`
}

/** Um chamado na lista do portal externo. */
export function SdExtTicketRow({
  ticket,
}: {
  ticket: SdPortalTicketSummaryDTO
}) {
  return (
    <li className='relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-blue-500/40'>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-mono text-muted-foreground text-xs'>
            {ticket.code}
          </span>
          <SdTypeBadge type={ticket.type} />
          <SdPhaseBadge phase={{ ...ticket.phase, name: ticket.phase.name }} />
        </div>
        <Link
          href={sdExtTicketHref(ticket.code)}
          className='mt-1 line-clamp-2 block font-medium text-sm after:absolute after:inset-0 after:content-[""] hover:underline'
        >
          {ticket.title}
        </Link>
        <div className='mt-2 flex items-center gap-3'>
          <SdProgressBar
            percent={ticket.completionPercent}
            color={ticket.phase.color}
            className='w-full max-w-56'
          />
          <span className='shrink-0 text-muted-foreground text-xs tabular-nums'>
            {ticket.completionPercent}%
          </span>
        </div>
        <p className='mt-1 text-muted-foreground text-xs'>
          {ticket.companyName ? `${ticket.companyName} · ` : ''}
          {ticket.assigneeName
            ? `Atendendo: ${ticket.assigneeName} · `
            : 'Aguardando a equipe · '}
          atualizado {sdRelativeTime(ticket.lastActivityAt)}
        </p>
      </div>
      <SteelIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        className='size-4 shrink-0 text-muted-foreground'
      />
    </li>
  )
}

/**
 * `/suporte/chamados`: os chamados que o contato pode ver (os dele e, se o
 * workspace quiser, os das empresas dele), separados em aberto × encerrados,
 * com busca por título ou código.
 */
export function SdExtTickets() {
  const [tab, setTab] = useState<Tab>('open')
  const [q, setQ] = useState('')
  const query = useSdPortalTickets({ status: tab, q: q.trim() || undefined })
  const items = query.data?.items ?? []

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div
          role='tablist'
          aria-label='Situação dos chamados'
          className='flex items-center gap-1 rounded-xl border border-border bg-card p-1'
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type='button'
              role='tab'
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 font-medium text-sm transition-colors',
                tab === item.id
                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Link
          href='/suporte/novo'
          className={buttonVariants({ className: 'shrink-0' })}
        >
          <SteelIcon icon={Add01Icon} strokeWidth={2} />
          Abrir chamado
        </Link>
      </div>

      <Input
        type='search'
        value={q}
        aria-label='Buscar chamado'
        placeholder='Buscar por assunto ou código (ex.: INC-000123)'
        onChange={(event) => setQ(event.target.value)}
      />

      {query.isError ? (
        <div className='flex flex-col items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4'>
          <p className='text-red-700 text-sm dark:text-red-300'>
            {query.error.message}
          </p>
          <Button variant='outline' size='sm' onClick={() => query.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : query.isLoading ? (
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-24 rounded-xl' />
          <Skeleton className='h-24 rounded-xl' />
        </div>
      ) : items.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-xl border border-border border-dashed bg-card/40 p-8 text-center'>
          <SteelIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={1.8}
            className='size-6 text-muted-foreground'
          />
          <p className='font-medium text-sm'>
            {tab === 'open'
              ? 'Nenhum chamado em aberto'
              : 'Nenhum chamado encerrado'}
          </p>
          <p className='max-w-sm text-muted-foreground text-xs'>
            {tab === 'open'
              ? 'Quando precisar de ajuda, clique em "Abrir chamado". Você acompanha cada passo por aqui.'
              : 'Os chamados resolvidos e fechados aparecem nesta aba.'}
          </p>
        </div>
      ) : (
        <ul className='flex flex-col gap-2'>
          {items.map((ticket) => (
            <SdExtTicketRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </div>
  )
}
