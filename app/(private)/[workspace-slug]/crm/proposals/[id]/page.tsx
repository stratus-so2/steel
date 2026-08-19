import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ProposalBuilder } from '@/app/_components/crm/proposal/proposal-builder'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Proposta | CRM | Steel',
  description: 'Editor de propostas comerciais de layout fixo',
}

export default async function CrmProposalBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ 'workspace-slug': string; id: string }>
  searchParams: Promise<{ templateId?: string }>
}) {
  const { 'workspace-slug': slug, id } = await params
  const { templateId } = await searchParams

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <div className='h-full w-full'>
      <ProposalBuilder
        workspaceId={membership.value.workspaceId}
        slug={slug}
        proposalId={id}
        currentUserId={session.value.user.id}
        initialTemplateId={templateId}
      />
    </div>
  )
}
