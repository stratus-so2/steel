import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SteelAgentNew } from '@/app/_components/steel-agents/steel-agent-new'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Novo agente | Steel AI | Steel',
  description: 'Crie um agente autônomo do Steel AI.',
}

export default async function NewSteelAgentPage({
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
    <SteelAgentNew
      workspaceId={membership.value.workspaceId}
      slug={slug}
      currentUserId={session.value.user.id}
    />
  )
}
