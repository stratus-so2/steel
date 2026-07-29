import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { WhatsappReportsList } from '@/app/_components/whatsapp/whatsapp-reports-list'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Relatórios | WhatsApp | Steel',
  description: 'Relatórios de conversas e transmissões do WhatsApp',
}

export default async function WhatsappReportsPage({
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
    <div className='w-full overflow-y-auto'>
      <WhatsappReportsList
        workspaceId={membership.value.workspaceId}
        slug={slug}
      />
    </div>
  )
}
