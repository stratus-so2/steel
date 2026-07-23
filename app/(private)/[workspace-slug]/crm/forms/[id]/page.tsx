import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { CrmFormBuilder } from '@/app/_components/crm/crm-form-builder'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Formulário | CRM | Steel',
  description: 'Editor de formulário do workspace',
}

export default async function CrmFormBuilderPage({
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
      <CrmFormBuilder
        workspaceId={membership.value.workspaceId}
        slug={slug}
        formId={id}
      />
    </div>
  )
}
