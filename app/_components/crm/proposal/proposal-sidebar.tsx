'use client'

import {
  Analytics01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Image01Icon,
  Note01Icon,
  TextIcon,
  Timer02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import type * as React from 'react'
import type { DocStats } from '@/app/_components/crm/rich-text/analyze'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import type {
  CrmProposalMetricsDTO,
  CrmProposalStatusDTO,
} from '@/types/crm-proposal'

type IconType = typeof TextIcon

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: IconType
  label: string
  value: string
}) {
  return (
    <div className='flex items-center justify-between gap-2 py-1.5 text-sm'>
      <span className='flex items-center gap-2 text-muted-foreground'>
        <SteelIcon icon={icon} strokeWidth={2} className='size-4 shrink-0' />
        {label}
      </span>
      <span className='font-medium tabular-nums'>{value}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide'>
      {children}
    </h3>
  )
}

export function ProposalSidebar({
  stats,
  status,
  publishing,
  onToggleStatus,
  shareUrl,
  metrics,
  onOpenMetrics,
}: {
  stats: DocStats
  status: CrmProposalStatusDTO
  publishing: boolean
  onToggleStatus: (online: boolean) => void
  shareUrl: string
  metrics: CrmProposalMetricsDTO | null
  onOpenMetrics: () => void
}) {
  const online = status === 'PUBLISHED'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      notify.success('Link copiado')
    } catch {
      notify.error('Não foi possível copiar o link')
    }
  }

  return (
    <aside className='flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-background/40 p-4'>
      {/* Status online/offline */}
      <section>
        <SectionTitle>Publicação</SectionTitle>
        <div className='flex items-center justify-between rounded-lg border p-3'>
          <div className='flex items-center gap-2'>
            <span
              className={cn(
                'size-2 rounded-full',
                online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
              aria-hidden
            />
            <span className='font-medium text-sm'>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <Switch
            checked={online}
            disabled={publishing}
            onCheckedChange={onToggleStatus}
            aria-label='Alternar publicação'
          />
        </div>
        {online ? (
          <div className='mt-2 flex items-center gap-1.5 rounded-md border bg-muted/40 p-1.5'>
            <span className='min-w-0 flex-1 truncate text-muted-foreground text-xs'>
              {shareUrl}
            </span>
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              aria-label='Copiar link'
              onClick={copyLink}
            >
              <SteelIcon icon={Copy01Icon} strokeWidth={2} />
            </Button>
          </div>
        ) : (
          <p className='mt-2 text-muted-foreground text-xs'>
            Publique para gerar o link público de visualização.
          </p>
        )}
      </section>

      <Separator />

      {/* Informações do documento */}
      <section>
        <SectionTitle>Documento</SectionTitle>
        <StatRow
          icon={TextIcon}
          label='Palavras'
          value={stats.words.toLocaleString('pt-BR')}
        />
        <StatRow
          icon={Timer02Icon}
          label='Tempo de leitura'
          value={stats.readingMinutes ? `~${stats.readingMinutes} min` : '—'}
        />
        <StatRow
          icon={Note01Icon}
          label='Seções'
          value={String(stats.headings)}
        />
        <StatRow
          icon={Image01Icon}
          label='Imagens / mídia'
          value={String(stats.media)}
        />
      </section>

      <Separator />

      {/* Métricas de leitura do público */}
      <section>
        <SectionTitle>Leitura do público</SectionTitle>
        <StatRow
          icon={Analytics01Icon}
          label='Visualizações'
          value={metrics ? metrics.totalViews.toLocaleString('pt-BR') : '—'}
        />
        <StatRow
          icon={CheckmarkCircle02Icon}
          label='Conclusão'
          value={metrics ? `${Math.round(metrics.completionRate * 100)}%` : '—'}
        />
        <StatRow
          icon={Timer02Icon}
          label='Tempo médio'
          value={metrics ? formatDuration(metrics.avgDurationMs) : '—'}
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='mt-2 w-full'
          onClick={onOpenMetrics}
        >
          <SteelIcon icon={Analytics01Icon} strokeWidth={2} />
          Ver métricas
        </Button>
      </section>
    </aside>
  )
}
