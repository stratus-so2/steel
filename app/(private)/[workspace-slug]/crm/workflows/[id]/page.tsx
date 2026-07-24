import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { WorkflowEditor } from '@/app/_components/crm/workflow/workflow-editor'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Workflow | CRM | Steel',
  description: 'Editor visual de workflows do workspace',
}

export default async function CrmWorkflowEditorPage({
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
      <WorkflowEditor
        workspaceId={membership.value.workspaceId}
        slug={slug}
        workflowId={id}
      />
    </div>
  )
}
