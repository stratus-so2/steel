import { ServerStack01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SdConfigItemsView } from '@/app/_components/servicedesk/directory/config-items/sd-config-items-view'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdDirectoryShell } from '@/app/_components/servicedesk/directory/sd-directory-shell'

export const metadata: Metadata = {
  title: 'Itens de configuração | ServiceDesk | Steel',
  description: 'CMDB: itens de configuração e seus relacionamentos',
}

export default async function SdConfigItemsPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()

  return (
    <SdDirectoryShell
      title='Itens de configuração'
      icon={ServerStack01Icon}
      isAgent={ctx.isAgent}
    >
      <SdConfigItemsView
        workspaceId={ctx.workspaceId}
        slug={slug}
        canManageTypes={ctx.isAdmin}
      />
    </SdDirectoryShell>
  )
}
