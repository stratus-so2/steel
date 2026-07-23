import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { CrmReportBuilder } from '@/app/_components/crm/report/crm-report-builder'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Relatório | CRM | Steel',
  description: 'Construtor de relatórios do workspace',
}

export default async function CrmReportBuilderPage({
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
      <CrmReportBuilder
        workspaceId={membership.value.workspaceId}
        slug={slug}
        reportId={id}
      />
    </div>
  )
}
