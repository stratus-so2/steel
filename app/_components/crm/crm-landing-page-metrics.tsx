'use client'

import { useMemo } from 'react'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import type { CrmLandingPageViewDTO } from '@/types/crm-landing-page'

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function referrerLabel(referrer: string | null): string {
  if (!referrer) return 'Direto / desconhecido'
  try {
    return new URL(referrer).hostname.replace(/^www\./, '')
  } catch {
    return referrer
  }
}

/** Métricas agregadas de acesso, computadas no client a partir das visitas
 * brutas — sem endpoint de agregação dedicado no backend. */
export function CrmLandingPageMetrics({
  workspaceId,
  pageId,
}: {
  workspaceId: string
  pageId: string
}) {
  const { items: views, isLoading } = useCrmResourceList<CrmLandingPageViewDTO>(
    workspaceId,
    `landing-pages/${pageId}/views`,
  )

  const summary = useMemo(() => {
    const totalViews = views.length
    const totalCtaClicks = views.reduce((sum, v) => sum + v.ctaClicks, 0)
    const avgDurationMs = totalViews
      ? views.reduce((sum, v) => sum + v.durationMs, 0) / totalViews
      : 0
    return { totalViews, totalCtaClicks, avgDurationMs }
  }, [views])

  if (isLoading) return null

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-xs'>Métricas de acesso</p>
      <div className='grid grid-cols-3 gap-2 text-sm'>
        <div className='rounded-lg border border-border bg-card p-3'>
          <dt className='text-muted-foreground text-xs'>Visitas</dt>
          <dd className='mt-1 font-semibold text-lg tabular-nums'>
            {summary.totalViews}
          </dd>
        </div>
        <div className='rounded-lg border border-border bg-card p-3'>
          <dt className='text-muted-foreground text-xs'>Duração média</dt>
          <dd className='mt-1 font-semibold text-lg tabular-nums'>
            {formatDuration(summary.avgDurationMs)}
          </dd>
        </div>
        <div className='rounded-lg border border-border bg-card p-3'>
          <dt className='text-muted-foreground text-xs'>Cliques em CTA</dt>
          <dd className='mt-1 font-semibold text-lg tabular-nums'>
            {summary.totalCtaClicks}
          </dd>
        </div>
      </div>
      {views.length > 0 ? (
        <ul className='max-h-64 divide-y divide-border overflow-auto rounded-lg border border-border'>
          {views.map((v) => (
            <li
              key={v.id}
              className='flex items-center justify-between gap-2 px-3 py-2 text-sm'
            >
              <span className='min-w-0 truncate text-muted-foreground'>
                {referrerLabel(v.referrer)}
              </span>
              <span className='shrink-0 tabular-nums text-muted-foreground text-xs'>
                {formatDuration(v.durationMs)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
