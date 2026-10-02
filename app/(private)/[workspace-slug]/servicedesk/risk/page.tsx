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
      {/* Duas tabelas padrão empilhadas: cada seção fica com a sua metade e
          rola por dentro. Um único container com `overflow-auto` em volta
          quebraria o cabeçalho fixo das duas. */}
      <div className='flex h-full min-h-0 flex-col'>
        <p className='shrink-0 px-4 pt-3 text-muted-foreground text-xs'>
          A nota de risco é uma heurística explicável calculada pelo worker a
          cada 10 minutos — cada fator mostra o motivo, e nada passa por IA
          generativa.
        </p>
        <section className='flex min-h-0 flex-1 flex-col'>
          <h2 className='shrink-0 px-4 pt-3 font-semibold text-sm'>
            Chamados por risco
          </h2>
          <Suspense>
            <SdRiskQueue workspaceId={ctx.workspaceId} slug={slug} />
          </Suspense>
        </section>
        <section className='flex min-h-0 flex-1 flex-col border-t'>
          <h2 className='shrink-0 px-4 pt-3 font-semibold text-sm'>
            Incidentes repetidos — sugestões de problema
          </h2>
          <Suspense>
            <SdIncidentClusters workspaceId={ctx.workspaceId} slug={slug} />
          </Suspense>
        </section>
      </div>
    </SdPageShell>
  )
}
