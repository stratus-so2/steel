'use client'

import { ArrowDown01Icon, InboxIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SdRiskBadge } from '../risk/sd-risk-badge'
import {
  SdLevelBadge,
  SdPhaseBadge,
  SdSlaChip,
  SdTypeBadge,
  SdUserAvatar,
  useSdNow,
} from '../ticket/sd-ticket-badges'
import {
  sdPrimarySla,
  sdRelativeTime,
  sdTicketHref,
} from '../ticket/sd-ticket-meta'
import type { SdListGroup } from './sd-board-state'
import { sdGroupTickets } from './sd-list-groups'

export function SdTicketRow({
  ticket,
  slug,
  now,
  showType,
  showPhase = true,
}: {
  ticket: SdTicketDTO
  slug: string
  now: Date
  showType?: boolean
  showPhase?: boolean
}) {
  const { kind, live } = sdPrimarySla(ticket.sla, now)
  const customer = ticket.customer ?? ticket.company
  return (
    <Link
      href={sdTicketHref(slug, ticket)}
      data-shortcut-row={ticket.id}
      data-shortcut-href={sdTicketHref(slug, ticket)}
      className='group relative flex min-w-0 items-center gap-3 border-b py-2 pr-3 pl-4 text-sm outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset'
    >
      <span
        aria-hidden
        className='absolute inset-y-1 left-1 w-1 rounded-full'
        style={{ backgroundColor: ticket.priority?.color ?? 'transparent' }}
      />
      <span className='w-24 shrink-0 font-mono text-muted-foreground text-xs'>
        {ticket.code}
      </span>
      {showType ? <SdTypeBadge type={ticket.type} /> : null}
      <span className='min-w-0 flex-1 truncate font-medium'>
        {ticket.title}
      </span>
      {customer ? (
        <span className='hidden max-w-40 truncate text-muted-foreground text-xs lg:inline'>
          {customer.tradeName ?? customer.name}
        </span>
      ) : null}
      {showPhase ? (
        <SdPhaseBadge phase={ticket.phase} className='hidden md:inline-flex' />
      ) : null}
      <SdLevelBadge level={ticket.priority} className='hidden sm:inline-flex' />
      <SdSlaChip
        live={live}
        compact
        label={kind === 'firstResponse' ? '1ª resposta' : 'Resolução'}
      />
      <SdRiskBadge risk={ticket.risk} className='hidden sm:inline-flex' />
      <span className='hidden w-16 text-right text-muted-foreground text-xs tabular-nums xl:inline'>
        {sdRelativeTime(ticket.lastActivityAt, now)}
      </span>
      <SdUserAvatar user={ticket.assignee} className='size-6' />
    </Link>
  )
}

/** Lista densa agrupada (fase, prioridade, responsável, departamento, SLA). */
export function SdListView({
  tickets,
  slug,
  group,
  loading,
  showType,
  hasMore,
  loadingMore,
  onLoadMore,
  total,
}: {
  tickets: SdTicketDTO[]
  slug: string
  group: SdListGroup
  loading?: boolean
  showType?: boolean
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  total?: number
}) {
  const now = useSdNow()
  const [collapsed, setCollapsed] = useState<string[]>([])

  if (loading) {
    return (
      <div className='flex flex-col gap-2 p-4'>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={`sk-${i}`} className='h-9 w-full' />
        ))}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-2 py-20 text-center'>
        <div className='flex size-12 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground'>
          <SteelIcon icon={InboxIcon} strokeWidth={1.8} className='size-5' />
        </div>
        <p className='font-medium text-sm'>Nenhum chamado encontrado</p>
        <p className='text-muted-foreground text-xs'>
          Ajuste os filtros ou abra um novo chamado.
        </p>
      </div>
    )
  }

  const groups = sdGroupTickets(tickets, group, now)

  return (
    <div className='flex flex-col gap-3 p-4'>
      {groups.map((g) => {
        const isCollapsed = collapsed.includes(g.key)
        return (
          <section
            key={g.key}
            className='overflow-hidden rounded-xl border bg-card/40'
          >
            <button
              type='button'
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((current) =>
                  isCollapsed
                    ? current.filter((k) => k !== g.key)
                    : [...current, g.key],
                )
              }
              className='flex w-full items-center gap-2 border-b bg-muted/30 px-3 py-2 text-left'
            >
              <SteelIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  isCollapsed && '-rotate-90',
                )}
              />
              {g.color ? (
                <span
                  className='size-2.5 rounded-full'
                  style={{ backgroundColor: g.color }}
                />
              ) : null}
              <span className='font-semibold text-sm'>{g.label}</span>
              <span className='rounded-md bg-background px-1.5 text-muted-foreground text-xs tabular-nums'>
                {g.items.length}
              </span>
            </button>
            {isCollapsed ? null : (
              <div>
                {g.items.map((ticket) => (
                  <SdTicketRow
                    key={ticket.id}
                    ticket={ticket}
                    slug={slug}
                    now={now}
                    showType={showType}
                    showPhase={group !== 'phase'}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
      <div className='flex items-center justify-between text-muted-foreground text-xs'>
        <span className='tabular-nums'>
          {tickets.length}
          {total !== undefined ? ` de ${total}` : ''} chamados
        </span>
        {hasMore ? (
          <Button
            variant='outline'
            size='sm'
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
