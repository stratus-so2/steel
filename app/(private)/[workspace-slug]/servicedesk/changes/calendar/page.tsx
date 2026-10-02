import { Calendar03Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SdChangeCalendar } from '@/app/_components/servicedesk/changes/sd-change-calendar'
import { SdChangeViewSwitch } from '@/app/_components/servicedesk/changes/sd-change-view-switch'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdPageShell } from '@/app/_components/servicedesk/shell/sd-page-shell'

export const metadata: Metadata = {
  title: 'Calendário de mudanças | ServiceDesk | Steel',
  description:
    'Calendário de mudanças do ServiceDesk: janelas de manutenção, congelamentos e as mudanças agendadas.',
}

export default async function SdChangeCalendarPage({
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
      icon={Calendar03Icon}
      isAgent={ctx.isAgent}
    >
      <div className='flex h-full min-h-0 flex-col'>
        <div className='flex items-center justify-between gap-3 px-4 pt-3'>
          <SdChangeViewSwitch slug={slug} active='calendar' />
        </div>
        <Suspense>
          <SdChangeCalendar workspaceId={ctx.workspaceId} slug={slug} />
        </Suspense>
      </div>
    </SdPageShell>
  )
}
