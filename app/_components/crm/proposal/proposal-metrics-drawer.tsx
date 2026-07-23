'use client'

import {
  Analytics01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Timer02Icon,
  UserGroupIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getCrmProposalMetrics } from '@/src/hooks/use-crm-proposal'
import type { CrmProposalMetricsDTO } from '@/types/crm-proposal'

type IconType = typeof Analytics01Icon

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: IconType
  label: string
  value: string
}) {
  return (
    <div className='rounded-lg border bg-card p-3'>
      <div className='flex items-center gap-1.5 text-muted-foreground text-xs'>
        <SteelIcon icon={icon} strokeWidth={2} className='size-3.5' />
        {label}
      </div>
      <div className='mt-1 font-semibold text-lg tabular-nums'>{value}</div>
    </div>
  )
}

export function ProposalMetricsDrawer({
  workspaceId,
  proposalId,
  open,
  onOpenChange,
  onLoaded,
}: {
  workspaceId: string
  proposalId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Propaga as métricas carregadas (ex.: para o resumo da sidebar). */
  onLoaded?: (metrics: CrmProposalMetricsDTO) => void
}) {
  const [metrics, setMetrics] = useState<CrmProposalMetricsDTO | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getCrmProposalMetrics(workspaceId, proposalId)
      .then((data) => {
        if (data) {
          setMetrics(data)
          onLoaded?.(data)
        }
      })
      .finally(() => setLoading(false))
  }, [open, workspaceId, proposalId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='!w-[480px] !max-w-[480px] overflow-auto p-0'
      >
        <div className='flex h-14 shrink-0 items-center gap-2 border-b px-4'>
          <SteelIcon icon={Analytics01Icon} strokeWidth={2} />
          <span className='font-semibold text-sm'>Métricas de leitura</span>
          <SheetClose
            className='ml-auto'
            nativeButton={true}
            render={
              <Button variant='ghost' size='icon-sm'>
                <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            }
          />
        </div>

        <div className='space-y-4 p-3'>
          {loading && <Skeleton className='h-24 w-full' />}

          {!loading && metrics && (
            <>
              <div className='grid grid-cols-2 gap-2'>
                <SummaryCard
                  icon={Analytics01Icon}
                  label='Visualizações'
                  value={metrics.totalViews.toLocaleString('pt-BR')}
                />
                <SummaryCard
                  icon={UserGroupIcon}
                  label='Visitantes únicos'
                  value={metrics.uniqueVisitors.toLocaleString('pt-BR')}
                />
                <SummaryCard
                  icon={CheckmarkCircle02Icon}
                  label='Conclusão'
                  value={`${Math.round(metrics.completionRate * 100)}%`}
                />
                <SummaryCard
                  icon={Timer02Icon}
                  label='Tempo médio'
                  value={formatDuration(metrics.avgDurationMs)}
                />
              </div>

              <div>
                <h3 className='mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide'>
                  Visitas recentes
                </h3>
                {metrics.views.length === 0 ? (
                  <p className='py-8 text-center text-muted-foreground text-sm'>
                    Nenhuma visita registrada ainda. Compartilhe o link público
                    para começar a coletar métricas.
                  </p>
                ) : (
                  <ul className='space-y-1.5'>
                    {metrics.views.map((view) => (
                      <li
                        key={view.id}
                        className='flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm'
                      >
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            view.reachedEnd
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {view.reachedEnd
                            ? 'Concluiu'
                            : `${view.scrolledPct}%`}
                        </span>
                        <span className='text-muted-foreground tabular-nums'>
                          {formatDuration(view.durationMs)}
                        </span>
                        <span className='ml-auto text-muted-foreground text-xs'>
                          {new Date(view.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
