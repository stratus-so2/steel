import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HeaderBreadcrumbCrumb } from '@/app/_components/header/breadcrumb-page'
import { SdPortalNewTicket } from '@/app/_components/servicedesk/portal/sd-portal-new-ticket'
import { getSdPortalViewer } from '@/app/_components/servicedesk/portal/sd-portal-server-context'
import { SdPortalShell } from '@/app/_components/servicedesk/portal/sd-portal-shell'

export const metadata: Metadata = {
  title: 'Abrir chamado | ServiceDesk | Steel',
  description: 'Abra um chamado para a equipe de TI.',
}

export default async function SdPortalNewTicketPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const viewer = await getSdPortalViewer(slug)
  if (!viewer) notFound()

  return (
    <SdPortalShell
      viewer={viewer}
      crumbs={
        <HeaderBreadcrumbCrumb title='Abrir chamado'>
          <span className='text-muted-foreground'>/</span>
        </HeaderBreadcrumbCrumb>
      }
    >
      <SdPortalNewTicket
        workspaceId={viewer.workspaceId}
        slug={slug}
        portalTicketTypes={viewer.portalTicketTypes}
      />
    </SdPortalShell>
  )
}
