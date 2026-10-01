import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getSdDashboardViewer,
  listSdDashboards,
} from '@/app/_components/servicedesk/dashboards/sd-dashboard-server-context'
import { SdDashboardTv } from '@/app/_components/servicedesk/dashboards/sd-dashboard-tv'

export const metadata: Metadata = {
  title: 'Modo TV | Painéis | ServiceDesk | Steel',
  description: 'Painel do ServiceDesk em tela cheia para o telão da operação.',
}

/**
 * Modo TV: tela cheia, sem a casca do app (o painel cobre a janela).
 * `?rotate=id1,id2` alterna entre painéis e `?interval=60` define em
 * quantos segundos.
 */
export default async function SdDashboardTvPage({
  params,
  searchParams,
}: {
  params: Promise<{ 'workspace-slug': string; id: string }>
  searchParams: Promise<{ rotate?: string; interval?: string }>
}) {
  const { 'workspace-slug': slug, id } = await params
  const { rotate, interval } = await searchParams
  const viewer = await getSdDashboardViewer(slug)
  if (!viewer?.isAgent) notFound()

  const dashboards = await listSdDashboards(viewer)
  if (!dashboards.some((dashboard) => dashboard.id === id)) notFound()

  return (
    <SdDashboardTv
      workspaceId={viewer.workspaceId}
      slug={slug}
      dashboardId={id}
      dashboards={dashboards.map((dashboard) => ({
        id: dashboard.id,
        title: dashboard.title,
      }))}
      rotate={rotate}
      interval={interval}
    />
  )
}
