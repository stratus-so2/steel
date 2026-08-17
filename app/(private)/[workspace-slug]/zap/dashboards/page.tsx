import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { WhatsappDashboardsList } from '@/app/_components/whatsapp/whatsapp-dashboards-list'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Painéis | WhatsApp | Steel',
  description: 'Painéis customizados de WhatsApp',
}

export default async function WhatsappDashboardsPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <div className='h-full w-full overflow-y-auto'>
      <WhatsappDashboardsList
        workspaceId={membership.value.workspaceId}
        slug={slug}
      />
    </div>
  )
}
