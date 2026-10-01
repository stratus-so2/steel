import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SdPortalHome } from '@/app/_components/servicedesk/portal/sd-portal-home'
import { getSdPortalViewer } from '@/app/_components/servicedesk/portal/sd-portal-server-context'
import { SdPortalShell } from '@/app/_components/servicedesk/portal/sd-portal-shell'

export const metadata: Metadata = {
  title: 'Portal do solicitante | ServiceDesk | Steel',
  description: 'Abra e acompanhe seus chamados de TI.',
}

export default async function SdPortalPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const viewer = await getSdPortalViewer(slug)
  if (!viewer) notFound()

  return (
    <SdPortalShell viewer={viewer}>
      <SdPortalHome
        workspaceId={viewer.workspaceId}
        slug={slug}
        userName={viewer.userName}
        aiPreServiceEnabled={viewer.aiPreServiceEnabled}
      />
    </SdPortalShell>
  )
}
