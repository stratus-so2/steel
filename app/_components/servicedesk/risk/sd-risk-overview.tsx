'use client'

import { InboxIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSdRiskTickets } from '@/src/hooks/use-sd-risk'
import { SD_RISK_LEVEL_LABEL } from '@/src/lib/servicedesk/risk'
import type { SdRiskLevelDTO } from '@/types/sd-risk'
import { SdTicketRow } from '../board/sd-list-view'
import { useSdNow } from '../ticket/sd-ticket-badges'

/**
 * Tela "Análise de risco": a fila por risco (previsão pronta do worker, com
 * o motivo em cada selo) e, ao lado, as sugestões de problema a partir de
 * incidentes repetidos.
 */

const LEVELS: SdRiskLevelDTO[] = ['HIGH', 'MEDIUM', 'LOW']

export function SdRiskQueue({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const [level, setLevel] = useState<SdRiskLevelDTO>('HIGH')
  const now = useSdNow()
  const { data, isLoading } = useSdRiskTickets(workspaceId, { level })

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <h2 className='font-semibold text-sm'>Chamados por risco</h2>
        <div className='flex items-center gap-1'>
          {LEVELS.map((option) => (
            <button
              key={option}
              type='button'
              aria-pressed={level === option}
              onClick={() => setLevel(option)}
              className={cn(
                'h-7 rounded-full border px-2.5 font-medium text-xs transition-colors',
                level === option
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {SD_RISK_LEVEL_LABEL[option]}
            </button>
          ))}
        </div>
        <Link
          href={`/${slug}/servicedesk/tickets?riskLevel=HIGH&mode=list`}
          className='ml-auto text-muted-foreground text-xs hover:text-foreground hover:underline'
        >
          Ver no quadro
        </Link>
      </div>

      {isLoading ? (
        <div className='flex flex-col gap-2'>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`sk-risk-${i}`} className='h-9 w-full' />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center'>
          <div className='grid size-10 place-items-center rounded-2xl border bg-muted text-muted-foreground'>
            <SteelIcon icon={InboxIcon} strokeWidth={1.8} className='size-5' />
          </div>
          <p className='font-medium text-sm'>
            Nenhum chamado em {SD_RISK_LEVEL_LABEL[level].toLowerCase()}
          </p>
          <p className='max-w-sm text-muted-foreground text-xs'>
            A previsão é recalculada a cada 10 minutos sobre os chamados
            abertos.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          {data.map((ticket) => (
            <SdTicketRow
              key={ticket.id}
              ticket={ticket}
              slug={slug}
              now={now}
              showType
            />
          ))}
        </div>
      )}
    </div>
  )
}
