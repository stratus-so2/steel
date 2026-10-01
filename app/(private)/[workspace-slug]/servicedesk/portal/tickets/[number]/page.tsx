import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HeaderBreadcrumbCrumb } from '@/app/_components/header/breadcrumb-page'
import { getSdPortalViewer } from '@/app/_components/servicedesk/portal/sd-portal-server-context'
import { SdPortalShell } from '@/app/_components/servicedesk/portal/sd-portal-shell'
import { SdPortalTicket } from '@/app/_components/servicedesk/portal/sd-portal-ticket'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number } = await params
  const ref = decodeURIComponent(number).toUpperCase()
  return {
    title: `Chamado ${ref} | Portal | ServiceDesk | Steel`,
    description: 'Acompanhe o andamento do seu chamado.',
  }
}

/** Aceita número (`123`), código (`INC-000123`) ou id na URL. */
export default async function SdPortalTicketPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; number: string }>
}) {
  const { 'workspace-slug': slug, number } = await params
  const viewer = await getSdPortalViewer(slug)
  if (!viewer) notFound()
  const ref = decodeURIComponent(number)

  return (
    <SdPortalShell
      viewer={viewer}
      crumbs={
        <HeaderBreadcrumbCrumb title={ref.toUpperCase()}>
          <span className='text-muted-foreground'>/</span>
        </HeaderBreadcrumbCrumb>
      }
    >
      <SdPortalTicket
        workspaceId={viewer.workspaceId}
        slug={slug}
        ticketRef={ref}
      />
    </SdPortalShell>
  )
}
