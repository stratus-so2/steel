'use client'

import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { SdTicketDTO } from '@/types/sd-ticket'
import {
  SdPhaseBadge,
  SdProgressBar,
  SdTypeBadge,
} from '../ticket/sd-ticket-badges'
import { sdRelativeTime } from '../ticket/sd-ticket-meta'

/** `/<slug>/servicedesk/portal/tickets/<número>`. */
export function sdPortalTicketHref(slug: string, ticketNumber: number): string {
  return `/${slug}/servicedesk/portal/tickets/${ticketNumber}`
}

/**
 * Um chamado na lista "Meus chamados" do portal: código, título, fase e a
 * barra de progresso (% da fase) — linguagem de quem pediu, não de quem
 * atende.
 */
export function SdPortalTicketRow({
  slug,
  ticket,
  className,
}: {
  slug: string
  ticket: SdTicketDTO
  className?: string
}) {
  return (
    <li
      className={cn(
        'relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40',
        className,
      )}
    >
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-mono text-muted-foreground text-xs'>
            {ticket.code}
          </span>
          <SdTypeBadge type={ticket.type} />
          <SdPhaseBadge phase={ticket.phase} />
        </div>
        <Link
          href={sdPortalTicketHref(slug, ticket.number)}
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
          Atualizado {sdRelativeTime(ticket.lastActivityAt)}
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
