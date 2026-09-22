import { Ticket01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { HeaderBreadcrumbCrumb } from '@/app/_components/header/breadcrumb-page'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdPageShell } from '@/app/_components/servicedesk/shell/sd-page-shell'
import { SdTicketScreen } from '@/app/_components/servicedesk/ticket/sd-ticket-screen'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number } = await params
  const ref = decodeURIComponent(number).toUpperCase()
  return {
    title: `Chamado ${ref} | ServiceDesk | Steel`,
    description: 'Tela do chamado do ServiceDesk',
  }
}

/** Aceita número (`123`), código (`INC-000123`) ou id na URL. */
export default async function SdTicketPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; number: string }>
}) {
  const { 'workspace-slug': slug, number } = await params
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()
  const ref = decodeURIComponent(number)
  // Solicitantes acompanham o chamado pelo portal.
  if (!ctx.isAgent) {
    redirect(`/${slug}/servicedesk/portal/tickets/${encodeURIComponent(ref)}`)
  }

  return (
    <SdPageShell
      slug={slug}
      title='Chamados'
      icon={Ticket01Icon}
      isAgent={ctx.isAgent}
      crumbs={
        <HeaderBreadcrumbCrumb title={ref.toUpperCase()}>
          <span className='text-muted-foreground'>/</span>
        </HeaderBreadcrumbCrumb>
      }
    >
      <Suspense>
        <SdTicketScreen
          workspaceId={ctx.workspaceId}
          slug={slug}
          ticketRef={ref}
        />
      </Suspense>
    </SdPageShell>
  )
}
