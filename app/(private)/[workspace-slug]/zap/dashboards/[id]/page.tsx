import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DashboardCanvas } from '@/app/_components/crm/dashboard/dashboard-canvas'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Painel | WhatsApp | Steel',
  description: 'Painel customizado de WhatsApp',
}

export default async function WhatsappDashboardPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; id: string }>
}) {
  const { 'workspace-slug': slug, id } = await params

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <div className='h-full w-full'>
      <DashboardCanvas
        workspaceId={membership.value.workspaceId}
        dashboardId={id}
        basePath='whatsapp'
      />
    </div>
  )
}
