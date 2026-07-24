import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { CrmLandingPageBuilder } from '@/app/_components/crm/landing-page/crm-landing-page-builder'
import { availableAiProviders } from '@/src/lib/ai/env'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Landing page | CRM | Steel',
  description: 'Construtor de landing pages com IA do workspace',
}

export default async function CrmLandingPageBuilderPage({
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
      <CrmLandingPageBuilder
        workspaceId={membership.value.workspaceId}
        slug={slug}
        pageId={id}
        providers={availableAiProviders()}
      />
    </div>
  )
}
