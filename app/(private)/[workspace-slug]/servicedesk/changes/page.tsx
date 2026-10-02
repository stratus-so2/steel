import { ArrowDataTransferHorizontalIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SdTicketBoard } from '@/app/_components/servicedesk/board/sd-ticket-board'
import { SdChangeViewSwitch } from '@/app/_components/servicedesk/changes/sd-change-view-switch'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdPageShell } from '@/app/_components/servicedesk/shell/sd-page-shell'

export const metadata: Metadata = {
  title: 'Mudanças | ServiceDesk | Steel',
  description: 'Mudanças do ServiceDesk',
}

export default async function SdChangesPage({
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
      title='Mudanças'
      icon={ArrowDataTransferHorizontalIcon}
      isAgent={ctx.isAgent}
    >
      <div className='flex h-full min-h-0 flex-col'>
        <div className='flex items-center justify-between gap-3 px-4 pt-3'>
          <SdChangeViewSwitch slug={slug} active='board' />
        </div>
        <Suspense>
          <SdTicketBoard
            workspaceId={ctx.workspaceId}
            slug={slug}
            fixedType='CHANGE'
            isAdmin={ctx.isAdmin}
          />
        </Suspense>
      </div>
    </SdPageShell>
  )
}
