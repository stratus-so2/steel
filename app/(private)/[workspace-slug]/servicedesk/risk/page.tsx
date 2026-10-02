import { AlertDiamondIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdIncidentClusters } from '@/app/_components/servicedesk/risk/sd-incident-clusters'
import { SdRiskQueue } from '@/app/_components/servicedesk/risk/sd-risk-overview'
import { SdPageShell } from '@/app/_components/servicedesk/shell/sd-page-shell'

export const metadata: Metadata = {
  title: 'Análise de risco | ServiceDesk | Steel',
  description:
    'Risco preditivo de violação de SLA e incidentes repetidos do ServiceDesk',
}

export default async function SdRiskPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()

  return (
    <SdPageShell
      slug={slug}
      title='Análise de risco'
      icon={AlertDiamondIcon}
      isAgent={ctx.isAgent}
    >
      <div className='flex h-full min-h-0 flex-col gap-5 overflow-auto p-4'>
        <p className='text-muted-foreground text-xs'>
          A nota de risco é uma heurística explicável calculada pelo worker a
          cada 10 minutos — cada fator mostra o motivo, e nada passa por IA
          generativa.
        </p>
        <Suspense>
          <SdRiskQueue workspaceId={ctx.workspaceId} slug={slug} />
        </Suspense>
        <div className='flex min-w-0 flex-col gap-2'>
          <h2 className='font-semibold text-sm'>
            Incidentes repetidos — sugestões de problema
          </h2>
          <Suspense>
            <SdIncidentClusters workspaceId={ctx.workspaceId} slug={slug} />
          </Suspense>
        </div>
      </div>
    </SdPageShell>
  )
}
