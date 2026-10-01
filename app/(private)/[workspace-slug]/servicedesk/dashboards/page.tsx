import { DashboardSquare01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSdDashboardViewer } from '@/app/_components/servicedesk/dashboards/sd-dashboard-server-context'
import { SdDashboardsList } from '@/app/_components/servicedesk/dashboards/sd-dashboards-list'
import { SdPageShell } from '@/app/_components/servicedesk/shell/sd-page-shell'

export const metadata: Metadata = {
  title: 'Painéis | ServiceDesk | Steel',
  description: 'Painéis de indicadores do ServiceDesk (SLA, backlog, CSAT).',
}

export default async function SdDashboardsPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const viewer = await getSdDashboardViewer(slug)
  if (!viewer) notFound()

  return (
    <SdPageShell
      slug={slug}
      title='Painéis'
      icon={DashboardSquare01Icon}
      isAgent={viewer.isAgent}
    >
      <SdDashboardsList
        workspaceId={viewer.workspaceId}
        slug={slug}
        canCreate={viewer.canCreate}
        canEdit={viewer.canEdit}
        canDelete={viewer.canDelete}
      />
    </SdPageShell>
  )
}
