'use client'

import {
  Building03Icon,
  HierarchyIcon,
  WhatsappIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SdRiskBadge } from '../risk/sd-risk-badge'
import {
  SdLevelBadge,
  SdSlaChip,
  SdTypeBadge,
  SdUserAvatar,
} from '../ticket/sd-ticket-badges'
import {
  SD_TONE,
  SD_TONE_TEXT,
  sdPrimarySla,
  sdTicketAge,
  sdTicketHref,
} from '../ticket/sd-ticket-meta'

/**
 * Cartão do chamado (kanban): barra de prioridade, código, título,
 * prioridade/severidade, SLA com contagem regressiva, responsável,
 * cliente, tags, filhos e idade.
 */
export function SdTicketCard({
  ticket,
  slug,
  now,
  showType,
  dragging,
  className,
}: {
  ticket: SdTicketDTO
  slug: string
  now: Date
  showType?: boolean
  dragging?: boolean
  className?: string
}) {
  const { kind, live } = sdPrimarySla(ticket.sla, now)
  const customer = ticket.customer ?? ticket.company
  const extraTags = ticket.tags.length - 2
  return (
    <article
      data-ticket-id={ticket.id}
      className={cn(
        'group relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-card py-2.5 pr-2.5 pl-3.5 text-sm shadow-xs transition-shadow hover:shadow-md',
        live.state === 'breached' && 'border-destructive/40',
        dragging && 'rotate-1 shadow-lg ring-2 ring-primary/40',
        className,
      )}
    >
      <span
        aria-hidden
        className='absolute inset-y-0 left-0 w-1'
        style={{ backgroundColor: ticket.priority?.color ?? 'transparent' }}
      />
      <div className='flex items-center gap-1.5'>
        <Link
          href={sdTicketHref(slug, ticket)}
          className='font-medium font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline'
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ticket.code}
        </Link>
        {showType ? <SdTypeBadge type={ticket.type} /> : null}
        <span className='ml-auto text-[11px] text-muted-foreground tabular-nums'>
          {sdTicketAge(ticket.createdAt, now)}
        </span>
      </div>

      <Link
        href={sdTicketHref(slug, ticket)}
        className='line-clamp-2 font-medium leading-snug hover:underline'
        onPointerDown={(e) => e.stopPropagation()}
      >
        {ticket.title}
      </Link>

      <div className='flex flex-wrap items-center gap-1'>
        <SdLevelBadge level={ticket.priority} />
        <SdLevelBadge level={ticket.severity} prefix='Sev.' />
        <SdSlaChip
          live={live}
          compact
          label={kind === 'firstResponse' ? '1ª resposta' : 'Resolução'}
        />
        <SdRiskBadge risk={ticket.risk} />
      </div>

      {customer || ticket.tags.length > 0 ? (
        <div className='flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-muted-foreground'>
          {customer ? (
            <span className='inline-flex min-w-0 max-w-full items-center gap-1'>
              <SteelIcon
                icon={Building03Icon}
                strokeWidth={2}
                className='size-3 shrink-0'
              />
              <span className='truncate'>
                {customer.tradeName ?? customer.name}
              </span>
            </span>
          ) : null}
          {ticket.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className='rounded bg-muted px-1 py-px text-[10px] text-foreground/80'
            >
              #{tag}
            </span>
          ))}
          {extraTags > 0 ? (
            <span className='text-[10px]'>+{extraTags}</span>
          ) : null}
        </div>
      ) : null}

      <div className='flex items-center gap-2 text-[11px] text-muted-foreground'>
        {ticket.childrenCount > 0 ? (
          <span
            className='inline-flex items-center gap-0.5'
            title={`${ticket.childrenCount} itens filhos`}
          >
            <SteelIcon
              icon={HierarchyIcon}
              strokeWidth={2}
              className='size-3'
            />
            {ticket.childrenCount}
          </span>
        ) : null}
        {ticket.whatsappConversationId ? (
          <SteelIcon
            icon={WhatsappIcon}
            strokeWidth={2}
            className={cn('size-3', SD_TONE_TEXT.emerald)}
            aria-label='Conversa no WhatsApp'
          />
        ) : null}
        {ticket.escalationLevel > 0 ? (
          <span className={cn('rounded px-1 font-medium', SD_TONE.orange)}>
            N{ticket.escalationLevel}
          </span>
        ) : null}
        <span className='ml-auto flex items-center gap-1'>
          {ticket.assignee ? (
            <span className='max-w-24 truncate'>
              {ticket.assignee.name.split(' ')[0]}
            </span>
          ) : (
            <span className='italic'>Sem responsável</span>
          )}
          <SdUserAvatar user={ticket.assignee} className='size-5' />
        </span>
      </div>
    </article>
  )
}
