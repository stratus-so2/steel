import { UserAccountIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SdCustomersView } from '@/app/_components/servicedesk/directory/customers/sd-customers-view'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdDirectoryShell } from '@/app/_components/servicedesk/directory/sd-directory-shell'

export const metadata: Metadata = {
  title: 'Clientes | ServiceDesk | Steel',
  description: 'Clientes atendidos pelo ServiceDesk',
}

export default async function SdCustomersPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()

  return (
    <SdDirectoryShell
      title='Clientes'
      icon={UserAccountIcon}
      isAgent={ctx.isAgent}
    >
      <SdCustomersView
        workspaceId={ctx.workspaceId}
        slug={slug}
        kind='CLIENT'
      />
    </SdDirectoryShell>
  )
}
