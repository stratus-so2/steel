import { ContactBookIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SdContactsView } from '@/app/_components/servicedesk/directory/contacts/sd-contacts-view'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdDirectoryShell } from '@/app/_components/servicedesk/directory/sd-directory-shell'

export const metadata: Metadata = {
  title: 'Contatos | ServiceDesk | Steel',
  description: 'Contatos de clientes e empresas',
}

export default async function SdContactsPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()

  return (
    <SdDirectoryShell
      title='Contatos'
      icon={ContactBookIcon}
      isAgent={ctx.isAgent}
    >
      <SdContactsView workspaceId={ctx.workspaceId} slug={slug} />
    </SdDirectoryShell>
  )
}
