import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ProposalTemplateEditor } from '@/app/_components/crm/proposal/proposal-template-editor'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Template de proposta | CRM | Steel',
  description: 'Editor de template de proposta comercial',
}

export default async function CrmProposalTemplateEditorPage({
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
      <ProposalTemplateEditor
        workspaceId={membership.value.workspaceId}
        templateId={id}
      />
    </div>
  )
}
