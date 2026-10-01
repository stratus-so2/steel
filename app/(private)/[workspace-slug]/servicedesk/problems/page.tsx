import { Bug01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SdTicketBoard } from '@/app/_components/servicedesk/board/sd-ticket-board'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdPageShell } from '@/app/_components/servicedesk/shell/sd-page-shell'

export const metadata: Metadata = {
  title: 'Problemas | ServiceDesk | Steel',
  description: 'Problemas do ServiceDesk',
}

export default async function SdProblemsPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()

  return (
    <SdPageShell
      slug={slug}
      title='Problemas'
      icon={Bug01Icon}
      isAgent={ctx.isAgent}
    >
      <Suspense>
        <SdTicketBoard
          workspaceId={ctx.workspaceId}
          slug={slug}
          fixedType='PROBLEM'
          isAdmin={ctx.isAdmin}
        />
      </Suspense>
    </SdPageShell>
  )
}
