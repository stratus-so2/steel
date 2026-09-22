import { Building03Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SdCustomersView } from '@/app/_components/servicedesk/directory/customers/sd-customers-view'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdDirectoryShell } from '@/app/_components/servicedesk/directory/sd-directory-shell'

export const metadata: Metadata = {
  title: 'Empresas | ServiceDesk | Steel',
  description: 'Empresas atendidas pelo ServiceDesk',
}

export default async function SdCompaniesPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()

  return (
    <SdDirectoryShell
      title='Empresas'
      icon={Building03Icon}
      isAgent={ctx.isAgent}
    >
      <SdCustomersView
        workspaceId={ctx.workspaceId}
        slug={slug}
        kind='COMPANY'
      />
    </SdDirectoryShell>
  )
}
